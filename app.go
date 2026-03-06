// Package main app.go 是 Wails 应用的核心入口绑定文件。
//
// 设计目的：
//   - 作为所有后端模块的组合根（Composition Root）
//   - 在 startup 阶段完成所有模块的依赖注入和初始化
//   - 对前端暴露顶层 API（各模块 API 通过组合方式挂载）
//
// 初始化顺序：
//  1. 加载配置（config）
//  2. 初始化日志（logger）
//  3. 初始化数据库（database）
//  4. 执行数据库迁移（migration）
//  5. 初始化加密模块（crypto）
//  6. 初始化各业务模块
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	assetAPI "EnvPilot/internal/asset/api"
	assetRepo "EnvPilot/internal/asset/repository"
	assetSvc "EnvPilot/internal/asset/service"
	configService "EnvPilot/internal/config/service"
	executorAPI "EnvPilot/internal/executor/api"
	executorRepo "EnvPilot/internal/executor/repository"
	executorSvc "EnvPilot/internal/executor/service"
	sshPool "EnvPilot/internal/executor/ssh"
	"EnvPilot/database"
	"EnvPilot/database/migration"
	"EnvPilot/pkg/crypto"
	"EnvPilot/pkg/logger"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// App Wails 应用主结构体，所有对前端暴露的方法都挂载在此
type App struct {
	ctx         context.Context
	config      *configService.ConfigService
	db          *gorm.DB
	AssetAPI    *assetAPI.AssetAPI    // 资产管理模块（Wails 自动绑定公开字段的公开方法）
	ExecutorAPI *executorAPI.ExecutorAPI // 命令执行 + 在线终端模块
}

// NewApp 创建应用实例并完成所有模块的初始化
func NewApp() (*App, error) {
	// ── 第一步：加载配置 ──────────────────────────────────────────
	cfgPath := findConfigPath()
	cfgSvc, err := configService.NewConfigService(cfgPath)
	if err != nil {
		return nil, fmt.Errorf("配置加载失败: %w", err)
	}
	cfg := cfgSvc.Get()

	// ── 第二步：初始化日志 ─────────────────────────────────────────
	logPath := filepath.Join(cfg.App.LogDir, cfg.Log.Filename)
	if err := logger.Init(logger.Config{
		Level:      cfg.Log.Level,
		FilePath:   logPath,
		MaxSize:    cfg.Log.MaxSize,
		MaxBackups: cfg.Log.MaxBackups,
		MaxAge:     cfg.Log.MaxAge,
		Compress:   cfg.Log.Compress,
	}); err != nil {
		return nil, fmt.Errorf("日志初始化失败: %w", err)
	}
	logger.Info("EnvPilot 启动中",
		zap.String("version", cfg.App.Version),
		zap.String("config", cfgPath),
	)

	// ── 第三步：初始化数据库 ───────────────────────────────────────
	dbPath := filepath.Join(cfg.App.DataDir, cfg.Database.Filename)
	db, err := database.NewDB(database.Config{
		FilePath:     dbPath,
		MaxIdleConns: cfg.Database.MaxIdleConns,
		MaxOpenConns: cfg.Database.MaxOpenConns,
		LogLevel:     "warn",
	})
	if err != nil {
		return nil, fmt.Errorf("数据库初始化失败: %w", err)
	}
	logger.Info("数据库连接成功", zap.String("path", dbPath))

	// ── 第四步：执行数据库迁移 ─────────────────────────────────────
	if err := migration.NewMigrator(db).Run(); err != nil {
		return nil, fmt.Errorf("数据库迁移失败: %w", err)
	}
	logger.Info("数据库迁移完成")

	// ── 第五步：初始化加密模块 ─────────────────────────────────────
	// 阶段1使用固定内置密钥（后续阶段实现主密码流程后替换）
	cipher, err := initCipher(cfg.App.DataDir, cfg.Security.SaltFile)
	if err != nil {
		return nil, fmt.Errorf("加密模块初始化失败: %w", err)
	}

	// ── 第六步：初始化业务模块 ─────────────────────────────────────
	// 共享 repo（供多个模块使用，避免重复创建）
	sharedAssetRepo := assetRepo.NewAssetRepo(db)
	sharedCredRepo  := assetRepo.NewCredentialRepo(db)
	sharedCredSvc   := assetSvc.NewCredentialService(sharedCredRepo, cipher)

	assetAPIInst    := buildAssetAPI(db, sharedAssetRepo, sharedCredSvc)
	executorAPIInst := buildExecutorAPI(db, sharedAssetRepo, sharedCredSvc)

	return &App{
		config:      cfgSvc,
		db:          db,
		AssetAPI:    assetAPIInst,
		ExecutorAPI: executorAPIInst,
	}, nil
}

// buildAssetAPI 构建资产管理模块（依赖注入）
func buildAssetAPI(
	db *gorm.DB,
	ar *assetRepo.AssetRepo,
	credSvc *assetSvc.CredentialService,
) *assetAPI.AssetAPI {
	envRepo := assetRepo.NewEnvironmentRepo(db)
	grpRepo := assetRepo.NewGroupRepo(db)

	envSvc := assetSvc.NewEnvironmentService(envRepo)
	grpSvc := assetSvc.NewGroupService(grpRepo, envRepo)
	astSvc := assetSvc.NewAssetService(ar, envRepo)

	return assetAPI.NewAssetAPI(envSvc, grpSvc, astSvc, credSvc)
}

// buildExecutorAPI 构建执行器模块（依赖注入）
func buildExecutorAPI(
	db *gorm.DB,
	ar *assetRepo.AssetRepo,
	credSvc *assetSvc.CredentialService,
) *executorAPI.ExecutorAPI {
	pool     := sshPool.NewPool(ar, credSvc)
	execRepo := executorRepo.NewExecutionRepo(db)
	execSvc  := executorSvc.NewExecutorService(pool, execRepo, ar)
	termSvc  := executorSvc.NewTerminalService(pool)
	return executorAPI.NewExecutorAPI(execSvc, termSvc, pool)
}

// initCipher 初始化 AES 加密器。
// 若 salt 文件不存在则自动生成并保存（首次运行）。
// 当前阶段使用固定密码派生密钥，后续阶段接入主密码流程。
func initCipher(dataDir, saltFile string) (*crypto.AESCipher, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}

	saltPath := filepath.Join(dataDir, saltFile)
	var salt []byte

	if data, err := os.ReadFile(saltPath); err == nil {
		salt = data
	} else {
		// 首次运行，生成随机 salt 并持久化
		var genErr error
		salt, genErr = crypto.GenerateSalt()
		if genErr != nil {
			return nil, fmt.Errorf("生成 salt 失败: %w", genErr)
		}
		if writeErr := os.WriteFile(saltPath, salt, 0600); writeErr != nil {
			return nil, fmt.Errorf("保存 salt 失败: %w", writeErr)
		}
		logger.Info("已生成新的加密 salt", zap.String("path", saltPath))
	}

	// 阶段1：使用固定内置密码派生密钥（阶段8接入用户主密码后替换此处）
	const builtinPassword = "envpilot-builtin-key-phase1"
	return crypto.NewCipherFromPassword(builtinPassword, salt)
}

// ── Wails 生命周期 ────────────────────────────────────────────────

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.ExecutorAPI.SetContext(ctx)
	logger.Info("应用窗口已就绪")
}

func (a *App) domReady(ctx context.Context) {
	logger.Info("前端 DOM 就绪")
	// 通知前端桥接已就绪，解决页面刷新后 useEffect 比桥接更早触发导致数据为空的问题
	wailsruntime.EventsEmit(ctx, "backend:ready")
}

func (a *App) shutdown(ctx context.Context) {
	logger.Info("EnvPilot 正在关闭，清理资源...")
	// 关闭所有 SSH 连接和终端会话
	if a.ExecutorAPI != nil {
		a.ExecutorAPI.Cleanup()
		logger.Info("SSH 连接和终端会话已清理")
	}
	if a.db != nil {
		if sqlDB, err := a.db.DB(); err == nil {
			_ = sqlDB.Close()
			logger.Info("数据库连接已关闭")
		}
	}
	logger.Sync()
}

// ── 基础 API ──────────────────────────────────────────────────────

// Ping 连通性验证接口
func (a *App) Ping() string {
	return "pong"
}

// GetVersion 获取应用版本信息
func (a *App) GetVersion() map[string]string {
	cfg := a.config.Get()
	return map[string]string{
		"name":    cfg.App.Name,
		"version": cfg.App.Version,
	}
}

// findConfigPath 查找配置文件路径
func findConfigPath() string {
	for _, path := range []string{"config/config.yaml", "../config/config.yaml"} {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	return "config/config.yaml"
}

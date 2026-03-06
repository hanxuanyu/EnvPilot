// Package app 提供应用初始化逻辑的共享容器。
//
// 桌面模式（Wails）和服务端模式（HTTP）共用此包完成依赖注入，
// 本包不引入任何 Wails 依赖，确保服务端二进制不携带 WebView 相关代码。
package app

import (
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
	_ "EnvPilot/internal/plugin/builtin" // 触发所有内置插件的 init() 注册
	"EnvPilot/database"
	"EnvPilot/database/migration"
	"EnvPilot/pkg/crypto"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// Container 持有全部已初始化的服务实例。
// 既包含直接服务（供服务端 HTTP handler 使用），
// 也包含 Wails 绑定层（供桌面模式 App 使用）。
type Container struct {
	// ── 直接服务（无 Wails 依赖，服务端 HTTP 可直接调用）──
	EnvSvc  *assetSvc.EnvironmentService
	GrpSvc  *assetSvc.GroupService
	AssetSvc *assetSvc.AssetService
	CredSvc *assetSvc.CredentialService
	ExecSvc *executorSvc.ExecutorService
	TermSvc *executorSvc.TerminalService
	Pool    *sshPool.Pool
	Config  *configService.ConfigService

	// ── Wails 绑定层（桌面模式 App 使用）──
	AssetAPI    *assetAPI.AssetAPI
	ExecutorAPI *executorAPI.ExecutorAPI

	db *gorm.DB
}

// Cleanup 释放所有资源（SSH 连接、数据库连接等）
func (c *Container) Cleanup() {
	if c.ExecutorAPI != nil {
		c.ExecutorAPI.Cleanup()
	}
	if c.db != nil {
		if sqlDB, err := c.db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	}
	logger.Sync()
}

// Bootstrap 完成所有模块的初始化并返回 Container。
//
// 初始化顺序：
//  1. 加载配置
//  2. 初始化日志
//  3. 初始化数据库
//  4. 执行数据库迁移
//  5. 初始化加密模块
//  6. 构建所有业务服务和 API 层
func Bootstrap() (*Container, error) {
	// ── 1. 配置 ──────────────────────────────────────────────────
	cfgPath := findConfigPath()
	cfgSvc, err := configService.NewConfigService(cfgPath)
	if err != nil {
		return nil, fmt.Errorf("配置加载失败: %w", err)
	}
	cfg := cfgSvc.Get()

	// ── 2. 日志 ───────────────────────────────────────────────────
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

	// ── 3. 数据库 ─────────────────────────────────────────────────
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

	// ── 4. 迁移 ───────────────────────────────────────────────────
	if err := migration.NewMigrator(db).Run(); err != nil {
		return nil, fmt.Errorf("数据库迁移失败: %w", err)
	}
	logger.Info("数据库迁移完成")

	// ── 5. 加密 ───────────────────────────────────────────────────
	cipher, err := initCipher(cfg.App.DataDir, cfg.Security.SaltFile)
	if err != nil {
		return nil, fmt.Errorf("加密模块初始化失败: %w", err)
	}

	// ── 6. 业务模块 ───────────────────────────────────────────────
	sharedAssetRepo := assetRepo.NewAssetRepo(db)
	sharedCredRepo  := assetRepo.NewCredentialRepo(db)
	sharedCredSvc   := assetSvc.NewCredentialService(sharedCredRepo, cipher)

	envRepo  := assetRepo.NewEnvironmentRepo(db)
	grpRepo  := assetRepo.NewGroupRepo(db)
	envSvc   := assetSvc.NewEnvironmentService(envRepo)
	grpSvc   := assetSvc.NewGroupService(grpRepo, envRepo)
	astSvc   := assetSvc.NewAssetService(sharedAssetRepo, envRepo)

	assetAPIInst := assetAPI.NewAssetAPI(envSvc, grpSvc, astSvc, sharedCredSvc)

	pool     := sshPool.NewPool(sharedAssetRepo, sharedCredSvc)
	execRepo := executorRepo.NewExecutionRepo(db)
	execSvc  := executorSvc.NewExecutorService(pool, execRepo, sharedAssetRepo)
	termSvc  := executorSvc.NewTerminalService(pool)
	execAPIInst := executorAPI.NewExecutorAPI(execSvc, termSvc, pool)

	return &Container{
		EnvSvc:      envSvc,
		GrpSvc:      grpSvc,
		AssetSvc:    astSvc,
		CredSvc:     sharedCredSvc,
		ExecSvc:     execSvc,
		TermSvc:     termSvc,
		Pool:        pool,
		Config:      cfgSvc,
		AssetAPI:    assetAPIInst,
		ExecutorAPI: execAPIInst,
		db:          db,
	}, nil
}

// initCipher 初始化 AES 加密器（首次运行自动生成 salt）
func initCipher(dataDir, saltFile string) (*crypto.AESCipher, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}

	saltPath := filepath.Join(dataDir, saltFile)
	var salt []byte

	if data, err := os.ReadFile(saltPath); err == nil {
		salt = data
	} else {
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

	const builtinPassword = "envpilot-builtin-key-phase1"
	return crypto.NewCipherFromPassword(builtinPassword, salt)
}

// findConfigPath 查找配置文件路径
func findConfigPath() string {
	for _, path := range []string{
		"config/config.yaml",
		"../config/config.yaml",
		"../../config/config.yaml",
	} {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	return "config/config.yaml"
}

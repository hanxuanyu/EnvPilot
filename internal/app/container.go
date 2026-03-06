// Package app 提供应用初始化逻辑的共享容器。
//
// 桌面模式（Wails）和服务端模式（HTTP）共用此包完成依赖注入，
// 本包不引入任何 Wails 依赖，确保服务端二进制不携带 WebView 相关代码。
package app

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	assetAPI "EnvPilot/internal/asset/api"
	assetRepo "EnvPilot/internal/asset/repository"
	assetSvc "EnvPilot/internal/asset/service"
	configModel "EnvPilot/internal/config/model"
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
	cfgPath, dataBase, err := findOrCreateConfig()
	if err != nil {
		return nil, fmt.Errorf("配置文件初始化失败: %w", err)
	}
	cfgSvc, err := configService.NewConfigService(cfgPath)
	if err != nil {
		return nil, fmt.Errorf("配置加载失败: %w", err)
	}
	cfg := cfgSvc.Get()

	// dataBase 非空时，将相对 data_dir / log_dir 转为绝对路径，
	// 避免打包模式下 CWD 不确定（如 macOS .app 的 CWD = /）导致路径错误
	resolveRelativePaths(cfg, dataBase)

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

// findOrCreateConfig 按优先级查找配置文件，找不到时自动创建默认配置。
//
// 返回值：
//   - cfgPath:     配置文件的绝对路径
//   - resolveBase: data_dir / log_dir 相对路径的解析基准目录；
//     空字符串表示保持原样（开发模式，CWD 即项目根目录）
//
// 搜索/创建优先级：
//
//	┌──────────────────────────────────────────────────────────────┐
//	│  步骤  │ 路径                          │ 适用场景            │
//	├──────────────────────────────────────────────────────────────┤
//	│  1     │ 相对路径（config/config.yaml）│ wails dev / go run  │
//	│  2     │ 可执行文件同级 config/ 目录   │ Linux/Windows 部署  │
//	│  3     │ 用户配置目录                  │ 已安装/已初始化     │
//	│  4(创建)│ macOS → 用户配置目录         │ .app 首次启动       │
//	│        │ Linux/Windows → exe 目录（可写）或用户配置目录     │
//	└──────────────────────────────────────────────────────────────┘
func findOrCreateConfig() (cfgPath string, resolveBase string, err error) {
	// ── 1. 开发模式相对路径（CWD = 项目根目录）──────────────────
	for _, p := range []string{
		"config/config.yaml",
		"../config/config.yaml",
		"../../config/config.yaml",
	} {
		if _, statErr := os.Stat(p); statErr == nil {
			abs, absErr := filepath.Abs(p)
			if absErr != nil {
				abs = p
			}
			// resolveBase="" → data_dir/log_dir 仍相对 CWD（开发习惯不变）
			return abs, "", nil
		}
	}

	// ── 2. 可执行文件同级目录（Linux/Windows 绿色部署）──────────
	var exeDir string
	if exe, exeErr := os.Executable(); exeErr == nil {
		exeDir = filepath.Dir(filepath.Clean(exe))
		for _, p := range []string{
			filepath.Join(exeDir, "config", "config.yaml"),
			filepath.Join(exeDir, "config.yaml"),
		} {
			if _, statErr := os.Stat(p); statErr == nil {
				// 以 exe 目录为基准解析相对路径
				return p, exeDir, nil
			}
		}
	}

	// ── 3. 用户配置目录（已安装 / 之前已初始化）────────────────
	userCfgPath, ucErr := userConfigFilePath()
	if ucErr != nil {
		return "", "", fmt.Errorf("无法确定用户配置目录: %w", ucErr)
	}
	if _, statErr := os.Stat(userCfgPath); statErr == nil {
		return userCfgPath, filepath.Dir(userCfgPath), nil
	}

	// ── 4. 首次运行：选择写入位置并生成默认配置 ─────────────────
	createDir, base := chooseConfigCreateDir(exeDir, filepath.Dir(userCfgPath))
	if mkErr := os.MkdirAll(createDir, 0755); mkErr != nil {
		return "", "", fmt.Errorf("创建配置目录失败 [%s]: %w", createDir, mkErr)
	}
	defaultYAML, genErr := configService.GenerateDefaultYAML()
	if genErr != nil {
		return "", "", fmt.Errorf("生成默认配置失败: %w", genErr)
	}
	cfgFile := filepath.Join(createDir, "config.yaml")
	if writeErr := os.WriteFile(cfgFile, defaultYAML, 0644); writeErr != nil {
		return "", "", fmt.Errorf("写入默认配置失败 [%s]: %w", cfgFile, writeErr)
	}
	return cfgFile, base, nil
}

// chooseConfigCreateDir 根据平台和可写性决定首次创建配置文件的目录。
//
// 策略：
//   - macOS：.app 通常位于 /Applications（不可写），始终使用用户配置目录
//   - Linux / Windows：可执行文件目录可写时优先使用，否则回退到用户配置目录
//
// 返回 (配置目录, data_dir/log_dir 解析基准目录)。
func chooseConfigCreateDir(exeDir, userDir string) (createDir, base string) {
	if runtime.GOOS != "darwin" && exeDir != "" && isWritableDir(exeDir) {
		// 在 exe 目录下建 config/ 子目录存放配置，数据/日志与 exe 同级
		return filepath.Join(exeDir, "config"), exeDir
	}
	// macOS 或 exe 目录不可写 → 用户配置目录
	return userDir, userDir
}

// isWritableDir 通过临时文件探测目录是否可写。
func isWritableDir(dir string) bool {
	probe := filepath.Join(dir, ".envpilot_write_probe")
	f, err := os.OpenFile(probe, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return false
	}
	f.Close()
	os.Remove(probe)
	return true
}

// userConfigFilePath 返回当前用户专属的配置文件路径（不保证文件存在）。
//   - macOS:   ~/Library/Application Support/EnvPilot/config.yaml
//   - Linux:   ~/.config/EnvPilot/config.yaml
//   - Windows: %AppData%\EnvPilot\config.yaml
func userConfigFilePath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		home, homeErr := os.UserHomeDir()
		if homeErr != nil {
			return "", homeErr
		}
		dir = filepath.Join(home, ".config")
	}
	return filepath.Join(dir, "EnvPilot", "config.yaml"), nil
}

// resolveRelativePaths 将 data_dir / log_dir 中的相对路径转为绝对路径。
//
// baseDir 为空时不做任何转换（开发模式，CWD 就是正确基准）。
// 非空时以 baseDir 为根展开，确保打包/部署模式下路径稳定。
func resolveRelativePaths(cfg *configModel.AppConfig, baseDir string) {
	if baseDir == "" {
		return
	}
	if !filepath.IsAbs(cfg.App.DataDir) {
		cfg.App.DataDir = filepath.Clean(filepath.Join(baseDir, cfg.App.DataDir))
	}
	if !filepath.IsAbs(cfg.App.LogDir) {
		cfg.App.LogDir = filepath.Clean(filepath.Join(baseDir, cfg.App.LogDir))
	}
}

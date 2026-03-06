// Package service 实现配置文件的加载、校验与管理。
//
// 设计目的：
//   - 统一管理 YAML 配置文件的读取，避免各模块直接读取文件
//   - 提供配置校验，防止无效配置导致运行时崩溃
//   - 单例模式保证全局只有一份配置实例
//   - 支持运行时重新加载配置
//
// 使用方式：
//
//	// 应用启动时初始化
//	svc, err := service.NewConfigService("config/config.yaml")
//
//	// 获取配置
//	cfg := svc.Get()
//	fmt.Println(cfg.App.Name)
package service

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"EnvPilot/internal/config/model"

	"gopkg.in/yaml.v3"
)

// ConfigService 配置服务，负责加载和管理应用配置
type ConfigService struct {
	// configPath 配置文件路径
	configPath string
	// config 当前生效的配置（只读，通过 Get() 访问）
	config *model.AppConfig
	// mu 读写锁，保证并发安全
	mu sync.RWMutex
}

// NewConfigService 创建配置服务并立即加载配置文件。
// configPath 为 YAML 配置文件路径，支持相对路径。
func NewConfigService(configPath string) (*ConfigService, error) {
	svc := &ConfigService{
		configPath: configPath,
	}

	if err := svc.Load(); err != nil {
		return nil, fmt.Errorf("加载配置文件失败: %w", err)
	}

	return svc, nil
}

// Load 从磁盘读取并解析配置文件，同时执行校验。
// 可在运行时调用实现热重载。
func (s *ConfigService) Load() error {
	absPath, err := filepath.Abs(s.configPath)
	if err != nil {
		return fmt.Errorf("解析配置路径失败: %w", err)
	}

	data, err := os.ReadFile(absPath)
	if err != nil {
		return fmt.Errorf("读取配置文件失败 [%s]: %w", absPath, err)
	}

	var cfg model.AppConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return fmt.Errorf("解析 YAML 失败: %w", err)
	}

	// 校验配置合法性
	if err := validate(&cfg); err != nil {
		return fmt.Errorf("配置校验失败: %w", err)
	}

	// 填充默认值
	applyDefaults(&cfg)

	s.mu.Lock()
	s.config = &cfg
	s.mu.Unlock()

	return nil
}

// Get 获取当前配置（并发安全）
func (s *ConfigService) Get() *model.AppConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

// GetConfigPath 获取配置文件路径
func (s *ConfigService) GetConfigPath() string {
	return s.configPath
}

// validate 校验配置必填项和合法值
func validate(cfg *model.AppConfig) error {
	if cfg.App.Name == "" {
		return errors.New("app.name 不能为空")
	}

	validLevels := map[string]bool{"debug": true, "info": true, "warn": true, "error": true}
	if cfg.Log.Level != "" && !validLevels[cfg.Log.Level] {
		return fmt.Errorf("log.level 无效值: %s（有效值：debug/info/warn/error）", cfg.Log.Level)
	}

	if cfg.Health.CheckInterval < 0 {
		return errors.New("health.check_interval 不能为负数")
	}

	if cfg.DNS.DefaultTTL == 0 && cfg.DNS.Enabled {
		return errors.New("dns.default_ttl 启用 DNS 时不能为 0")
	}

	return nil
}

// applyDefaults 将 model.Default() 中的值填入 cfg 的空白字段。
// 不覆盖用户已显式配置的非零值，保持向后兼容。
func applyDefaults(cfg *model.AppConfig) {
	d := model.Default()

	// App
	if cfg.App.DataDir == "" {
		cfg.App.DataDir = d.App.DataDir
	}
	if cfg.App.LogDir == "" {
		cfg.App.LogDir = d.App.LogDir
	}

	// Log
	if cfg.Log.Level == "" {
		cfg.Log.Level = d.Log.Level
	}
	if cfg.Log.Filename == "" {
		cfg.Log.Filename = d.Log.Filename
	}
	if cfg.Log.MaxSize <= 0 {
		cfg.Log.MaxSize = d.Log.MaxSize
	}
	if cfg.Log.MaxBackups <= 0 {
		cfg.Log.MaxBackups = d.Log.MaxBackups
	}
	if cfg.Log.MaxAge <= 0 {
		cfg.Log.MaxAge = d.Log.MaxAge
	}

	// Database
	if cfg.Database.Filename == "" {
		cfg.Database.Filename = d.Database.Filename
	}
	if cfg.Database.MaxIdleConns <= 0 {
		cfg.Database.MaxIdleConns = d.Database.MaxIdleConns
	}
	if cfg.Database.MaxOpenConns <= 0 {
		cfg.Database.MaxOpenConns = d.Database.MaxOpenConns
	}

	// DNS
	if cfg.DNS.ListenAddr == "" {
		cfg.DNS.ListenAddr = d.DNS.ListenAddr
	}
	if cfg.DNS.Upstream == "" {
		cfg.DNS.Upstream = d.DNS.Upstream
	}
	if cfg.DNS.DefaultTTL == 0 {
		cfg.DNS.DefaultTTL = d.DNS.DefaultTTL
	}

	// Health
	if cfg.Health.CheckInterval <= 0 {
		cfg.Health.CheckInterval = d.Health.CheckInterval
	}
	if cfg.Health.Timeout <= 0 {
		cfg.Health.Timeout = d.Health.Timeout
	}

	// Security
	if cfg.Security.SaltFile == "" {
		cfg.Security.SaltFile = d.Security.SaltFile
	}
}

// GenerateDefaultYAML 将 model.Default() 序列化为 YAML，
// 用于在用户目录自动创建初始配置文件。
// 配置结构发生变更时只需维护 model.Default()，此处无需改动。
func GenerateDefaultYAML() ([]byte, error) {
	data, err := yaml.Marshal(model.Default())
	if err != nil {
		return nil, fmt.Errorf("序列化默认配置失败: %w", err)
	}
	var buf bytes.Buffer
	buf.WriteString("# EnvPilot 系统配置文件（自动生成，可按需修改后重启生效）\n")
	buf.Write(data)
	return buf.Bytes(), nil
}

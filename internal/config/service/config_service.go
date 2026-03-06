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

// applyDefaults 为未设置的字段填充合理默认值
func applyDefaults(cfg *model.AppConfig) {
	if cfg.App.DataDir == "" {
		cfg.App.DataDir = "./data"
	}
	if cfg.App.LogDir == "" {
		cfg.App.LogDir = "./logs"
	}
	if cfg.Log.Level == "" {
		cfg.Log.Level = "info"
	}
	if cfg.Log.Filename == "" {
		cfg.Log.Filename = "envpilot.log"
	}
	if cfg.Log.MaxSize <= 0 {
		cfg.Log.MaxSize = 100
	}
	if cfg.Log.MaxBackups <= 0 {
		cfg.Log.MaxBackups = 7
	}
	if cfg.Log.MaxAge <= 0 {
		cfg.Log.MaxAge = 30
	}
	if cfg.Database.Filename == "" {
		cfg.Database.Filename = "envpilot.db"
	}
	if cfg.Database.MaxIdleConns <= 0 {
		cfg.Database.MaxIdleConns = 2
	}
	if cfg.Database.MaxOpenConns <= 0 {
		cfg.Database.MaxOpenConns = 10
	}
	if cfg.DNS.ListenAddr == "" {
		cfg.DNS.ListenAddr = "127.0.0.1:5353"
	}
	if cfg.DNS.Upstream == "" {
		cfg.DNS.Upstream = "8.8.8.8:53"
	}
	if cfg.DNS.DefaultTTL == 0 {
		cfg.DNS.DefaultTTL = 300
	}
	if cfg.Health.CheckInterval <= 0 {
		cfg.Health.CheckInterval = 60
	}
	if cfg.Health.Timeout <= 0 {
		cfg.Health.Timeout = 10
	}
	if cfg.Security.SaltFile == "" {
		cfg.Security.SaltFile = ".salt"
	}
}

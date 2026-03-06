// Package model 定义系统配置的数据结构。
// 与 config.yaml 中的字段一一对应，使用 yaml tag 映射。
package model

// AppConfig 顶层配置结构体，对应 config.yaml 全部内容
type AppConfig struct {
	App      AppSection      `yaml:"app"`
	Log      LogSection      `yaml:"log"`
	Database DatabaseSection `yaml:"database"`
	Security SecuritySection `yaml:"security"`
	DNS      DNSSection      `yaml:"dns"`
	Health   HealthSection   `yaml:"health"`
}

// AppSection 应用基础配置
type AppSection struct {
	Name    string `yaml:"name"`
	Version string `yaml:"version"`
	DataDir string `yaml:"data_dir"`
	LogDir  string `yaml:"log_dir"`
}

// LogSection 日志配置
type LogSection struct {
	Level      string `yaml:"level"`
	Filename   string `yaml:"filename"`
	MaxSize    int    `yaml:"max_size"`
	MaxBackups int    `yaml:"max_backups"`
	MaxAge     int    `yaml:"max_age"`
	Compress   bool   `yaml:"compress"`
}

// DatabaseSection 数据库配置
type DatabaseSection struct {
	Filename     string `yaml:"filename"`
	MaxIdleConns int    `yaml:"max_idle_conns"`
	MaxOpenConns int    `yaml:"max_open_conns"`
}

// SecuritySection 安全配置
type SecuritySection struct {
	MasterPasswordEnabled bool     `yaml:"master_password_enabled"`
	SaltFile              string   `yaml:"salt_file"`
	DangerousCommands     []string `yaml:"dangerous_commands"`
}

// DNSSection 内置 DNS 服务配置
type DNSSection struct {
	Enabled    bool   `yaml:"enabled"`
	ListenAddr string `yaml:"listen_addr"`
	Upstream   string `yaml:"upstream"`
	DefaultTTL uint32 `yaml:"default_ttl"`
}

// HealthSection 健康检查配置
type HealthSection struct {
	CheckInterval int  `yaml:"check_interval"`
	Timeout       int  `yaml:"timeout"`
	AutoCheck     bool `yaml:"auto_check"`
}

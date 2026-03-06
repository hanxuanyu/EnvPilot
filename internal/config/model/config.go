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

// Default 返回填充了所有默认值的 AppConfig 实例。
//
// 这是全局唯一的默认值来源：
//   - service.applyDefaults 基于此函数补全缺失字段
//   - service.GenerateDefaultYAML 基于此函数生成初始配置文件内容
//
// 新增配置字段时，在此处补充对应默认值即可，其余逻辑自动同步。
func Default() *AppConfig {
	return &AppConfig{
		App: AppSection{
			Name:    "EnvPilot",
			Version: "0.1.0",
			DataDir: "./data",
			LogDir:  "./logs",
		},
		Log: LogSection{
			Level:      "info",
			Filename:   "envpilot.log",
			MaxSize:    100,
			MaxBackups: 7,
			MaxAge:     30,
			Compress:   true,
		},
		Database: DatabaseSection{
			Filename:     "envpilot.db",
			MaxIdleConns: 2,
			MaxOpenConns: 10,
		},
		Security: SecuritySection{
			MasterPasswordEnabled: false,
			SaltFile:              ".salt",
			DangerousCommands:     []string{"rm -rf", "DROP", "DELETE", "TRUNCATE", "FORMAT"},
		},
		DNS: DNSSection{
			Enabled:    false,
			ListenAddr: "127.0.0.1:5353",
			Upstream:   "8.8.8.8:53",
			DefaultTTL: 300,
		},
		Health: HealthSection{
			CheckInterval: 60,
			Timeout:       10,
			AutoCheck:     true,
		},
	}
}

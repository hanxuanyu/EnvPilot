// Package model 定义系统配置的数据结构。
// 与 config.yaml 中的字段一一对应，使用 yaml tag 映射。
package model

// AppConfig 顶层配置结构体，对应 config.yaml 全部内容
type AppConfig struct {
	App      AppSection      `yaml:"app" json:"app"`
	Log      LogSection      `yaml:"log" json:"log"`
	Database DatabaseSection `yaml:"database" json:"database"`
	Security SecuritySection `yaml:"security" json:"security"`
	DNS      DNSSection      `yaml:"dns" json:"dns"`
	Health   HealthSection   `yaml:"health" json:"health"`
	Audit    AuditSection    `yaml:"audit" json:"audit"`
}

// AppSection 应用基础配置
type AppSection struct {
	Name    string `yaml:"name" json:"name"`
	DataDir string `yaml:"data_dir" json:"data_dir"`
	LogDir  string `yaml:"log_dir" json:"log_dir"`
}

// LogSection 日志配置
type LogSection struct {
	Level      string `yaml:"level" json:"level"`
	Filename   string `yaml:"filename" json:"filename"`
	MaxSize    int    `yaml:"max_size" json:"max_size"`
	MaxBackups int    `yaml:"max_backups" json:"max_backups"`
	MaxAge     int    `yaml:"max_age" json:"max_age"`
	Compress   bool   `yaml:"compress" json:"compress"`
}

// DatabaseSection 数据库配置
type DatabaseSection struct {
	Driver string                `yaml:"driver" json:"driver"` // "mysql" 或 "sqlite"
	SQLite SQLiteDatabaseSection `yaml:"sqlite" json:"sqlite"`
	MySQL  MySQLDatabaseSection  `yaml:"mysql" json:"mysql"`
	Pool   DatabasePoolSection   `yaml:"pool" json:"pool"`

	// 兼容旧版平铺配置，读取后会自动迁移到 sqlite/mysql/pool 结构。
	LegacyHost         string `yaml:"host,omitempty" json:"-"`
	LegacyPort         int    `yaml:"port,omitempty" json:"-"`
	LegacyUsername     string `yaml:"username,omitempty" json:"-"`
	LegacyPassword     string `yaml:"password,omitempty" json:"-"`
	LegacyDBName       string `yaml:"dbname,omitempty" json:"-"`
	LegacyParams       string `yaml:"params,omitempty" json:"-"`
	LegacyFilename     string `yaml:"filename,omitempty" json:"-"`
	LegacyMaxIdleConns int    `yaml:"max_idle_conns,omitempty" json:"-"`
	LegacyMaxOpenConns int    `yaml:"max_open_conns,omitempty" json:"-"`
}

type SQLiteDatabaseSection struct {
	Filename string `yaml:"filename" json:"filename"`
}

type MySQLDatabaseSection struct {
	Host     string `yaml:"host" json:"host"`
	Port     int    `yaml:"port" json:"port"`
	Username string `yaml:"username" json:"username"`
	Password string `yaml:"password" json:"password"`
	DBName   string `yaml:"dbname" json:"dbname"`
	Params   string `yaml:"params" json:"params"`
}

type DatabasePoolSection struct {
	MaxIdleConns int `yaml:"max_idle_conns" json:"max_idle_conns"`
	MaxOpenConns int `yaml:"max_open_conns" json:"max_open_conns"`
}

func (d *DatabaseSection) NormalizeLegacy() {
	if d == nil {
		return
	}
	if d.LegacyFilename != "" {
		d.SQLite.Filename = d.LegacyFilename
	}
	if d.LegacyHost != "" {
		d.MySQL.Host = d.LegacyHost
	}
	if d.LegacyPort > 0 {
		d.MySQL.Port = d.LegacyPort
	}
	if d.LegacyUsername != "" {
		d.MySQL.Username = d.LegacyUsername
	}
	if d.LegacyPassword != "" {
		d.MySQL.Password = d.LegacyPassword
	}
	if d.LegacyDBName != "" {
		d.MySQL.DBName = d.LegacyDBName
	}
	if d.LegacyParams != "" {
		d.MySQL.Params = d.LegacyParams
	}
	if d.LegacyMaxIdleConns > 0 {
		d.Pool.MaxIdleConns = d.LegacyMaxIdleConns
	}
	if d.LegacyMaxOpenConns > 0 {
		d.Pool.MaxOpenConns = d.LegacyMaxOpenConns
	}
}

func (d *DatabaseSection) ClearLegacy() {
	if d == nil {
		return
	}
	d.LegacyHost = ""
	d.LegacyPort = 0
	d.LegacyUsername = ""
	d.LegacyPassword = ""
	d.LegacyDBName = ""
	d.LegacyParams = ""
	d.LegacyFilename = ""
	d.LegacyMaxIdleConns = 0
	d.LegacyMaxOpenConns = 0
}

// SecuritySection 安全配置
type SecuritySection struct {
	MasterPasswordEnabled bool     `yaml:"master_password_enabled" json:"master_password_enabled"`
	SaltFile              string   `yaml:"salt_file" json:"salt_file"`
	DangerousCommands     []string `yaml:"dangerous_commands" json:"dangerous_commands"`
}

// DNSSection 内置 DNS 服务配置
type DNSSection struct {
	Enabled    bool   `yaml:"enabled" json:"enabled"`
	ListenAddr string `yaml:"listen_addr" json:"listen_addr"`
	Upstream   string `yaml:"upstream" json:"upstream"`
	DefaultTTL uint32 `yaml:"default_ttl" json:"default_ttl"`
}

// HealthSection 健康检查配置
type HealthSection struct {
	CheckInterval int  `yaml:"check_interval" json:"check_interval"`
	Timeout       int  `yaml:"timeout" json:"timeout"`
	AutoCheck     bool `yaml:"auto_check" json:"auto_check"`
}

// AuditSection 审计日志保留与清理配置
type AuditSection struct {
	AutoCleanup          bool `yaml:"auto_cleanup" json:"auto_cleanup"`
	RetentionDays        int  `yaml:"retention_days" json:"retention_days"`
	MaxRecords           int  `yaml:"max_records" json:"max_records"`
	CleanupIntervalHours int  `yaml:"cleanup_interval_hours" json:"cleanup_interval_hours"`
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
			Driver: "sqlite",
			SQLite: SQLiteDatabaseSection{
				Filename: "envpilot.db",
			},
			MySQL: MySQLDatabaseSection{
				Host:     "127.0.0.1",
				Port:     3306,
				Username: "root",
				Password: "",
				DBName:   "envpilot",
				Params:   "charset=utf8mb4&parseTime=True&loc=UTC",
			},
			Pool: DatabasePoolSection{
				MaxIdleConns: 5,
				MaxOpenConns: 20,
			},
		},
		Security: SecuritySection{
			MasterPasswordEnabled: false,
			SaltFile:              ".salt",
			DangerousCommands:     []string{"rm -rf", "DROP", "DELETE", "TRUNCATE", "FORMAT"},
		},
		DNS: DNSSection{
			Enabled:    false,
			ListenAddr: "127.0.0.1:53",
			Upstream:   "8.8.8.8:53",
			DefaultTTL: 300,
		},
		Health: HealthSection{
			CheckInterval: 60,
			Timeout:       10,
			AutoCheck:     true,
		},
		Audit: AuditSection{
			AutoCleanup:          true,
			RetentionDays:        90,
			MaxRecords:           50000,
			CleanupIntervalHours: 24,
		},
	}
}

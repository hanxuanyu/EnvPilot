// Package database 负责数据库连接的初始化和生命周期管理。
//
// 支持 MySQL 和 SQLite 两种驱动，通过 Config.Driver 字段切换。
package database

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/glebarez/sqlite"
	mysqlDriver "gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Config 数据库连接配置
type Config struct {
	// Driver 数据库驱动：mysql 或 sqlite
	Driver string
	// FilePath SQLite 文件路径（driver=sqlite 时使用）
	FilePath string
	// Host MySQL 主机地址
	Host string
	// Port MySQL 端口
	Port int
	// Username MySQL 用户名
	Username string
	// Password MySQL 密码
	Password string
	// DBName MySQL 数据库名
	DBName string
	// Params MySQL DSN 额外参数
	Params string
	// MaxIdleConns 连接池最大空闲连接数
	MaxIdleConns int
	// MaxOpenConns 连接池最大打开连接数
	MaxOpenConns int
	// LogLevel GORM 日志级别：silent / error / warn / info
	LogLevel string
}

// NewDB 初始化数据库连接，返回 GORM DB 实例。
// 根据 Driver 字段选择 MySQL 或 SQLite 驱动。
func NewDB(cfg Config) (*gorm.DB, error) {
	gormLogLevel := parseGormLogLevel(cfg.LogLevel)
	gormCfg := &gorm.Config{
		Logger:                                   logger.Default.LogMode(gormLogLevel),
		DisableForeignKeyConstraintWhenMigrating: true,
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}

	var db *gorm.DB
	var err error

	switch cfg.Driver {
	case "sqlite":
		db, err = openSQLite(cfg, gormCfg)
	case "mysql", "":
		db, err = openMySQL(cfg, gormCfg)
	default:
		return nil, fmt.Errorf("不支持的数据库驱动: %s（支持 mysql / sqlite）", cfg.Driver)
	}
	if err != nil {
		return nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("获取底层 sql.DB 失败: %w", err)
	}

	maxIdle := cfg.MaxIdleConns
	if maxIdle <= 0 {
		maxIdle = 5
	}
	maxOpen := cfg.MaxOpenConns
	if maxOpen <= 0 {
		maxOpen = 20
	}

	sqlDB.SetMaxIdleConns(maxIdle)
	sqlDB.SetMaxOpenConns(maxOpen)

	if cfg.Driver == "sqlite" {
		sqlDB.SetConnMaxLifetime(time.Hour)
	} else {
		sqlDB.SetConnMaxLifetime(5 * time.Minute)
	}

	return db, nil
}

// openMySQL 初始化 MySQL 连接
func openMySQL(cfg Config, gormCfg *gorm.Config) (*gorm.DB, error) {
	host := cfg.Host
	if host == "" {
		host = "127.0.0.1"
	}
	port := cfg.Port
	if port <= 0 {
		port = 3306
	}
	params := cfg.Params
	if params == "" {
		params = "charset=utf8mb4&parseTime=True&loc=UTC"
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?%s",
		cfg.Username, cfg.Password, host, port, cfg.DBName, params)

	db, err := gorm.Open(mysqlDriver.Open(dsn), gormCfg)
	if err != nil {
		return nil, fmt.Errorf("连接 MySQL 数据库失败 [%s:%d/%s]: %w", host, port, cfg.DBName, err)
	}
	return db, nil
}

// openSQLite 初始化 SQLite 连接
func openSQLite(cfg Config, gormCfg *gorm.Config) (*gorm.DB, error) {
	dir := filepath.Dir(cfg.FilePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("创建数据目录失败 [%s]: %w", dir, err)
	}

	dsn := fmt.Sprintf("%s?_journal_mode=WAL", cfg.FilePath)
	db, err := gorm.Open(sqlite.Open(dsn), gormCfg)
	if err != nil {
		return nil, fmt.Errorf("打开 SQLite 数据库失败 [%s]: %w", cfg.FilePath, err)
	}
	return db, nil
}

// DSNDisplay 返回用于日志显示的数据库连接信息（隐藏密码）
func DSNDisplay(cfg Config) string {
	switch cfg.Driver {
	case "sqlite":
		return cfg.FilePath
	default:
		return fmt.Sprintf("%s@%s:%d/%s", cfg.Username, cfg.Host, cfg.Port, cfg.DBName)
	}
}

// parseGormLogLevel 将字符串转换为 GORM 日志级别
func parseGormLogLevel(level string) logger.LogLevel {
	switch level {
	case "silent":
		return logger.Silent
	case "error":
		return logger.Error
	case "info":
		return logger.Info
	default:
		return logger.Warn
	}
}

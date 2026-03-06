// Package database 负责 SQLite 数据库连接的初始化和生命周期管理。
//
// 设计目的：
//   - 统一数据库连接入口，所有模块共用同一个 GORM DB 实例
//   - 封装连接池参数配置
//   - 启用 WAL 模式提升并发读性能（SQLite 特性）
//
// 使用方式：
//
//	db, err := database.NewDB(database.Config{FilePath: "./data/envpilot.db"})
//	// 传入各模块 repository 使用
package database

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Config 数据库连接配置
type Config struct {
	// FilePath SQLite 文件路径
	FilePath string
	// MaxIdleConns 连接池最大空闲连接数
	MaxIdleConns int
	// MaxOpenConns 连接池最大打开连接数
	MaxOpenConns int
	// LogLevel GORM 日志级别：silent / error / warn / info
	LogLevel string
}

// NewDB 初始化 SQLite 数据库连接，返回 GORM DB 实例。
// 自动创建数据目录，启用 WAL 模式和外键约束。
func NewDB(cfg Config) (*gorm.DB, error) {
	// 确保数据目录存在
	dir := filepath.Dir(cfg.FilePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("创建数据目录失败 [%s]: %w", dir, err)
	}

	// 配置 GORM 日志（开发环境 info，生产环境 warn）
	gormLogLevel := parseGormLogLevel(cfg.LogLevel)
	gormCfg := &gorm.Config{
		Logger: logger.Default.LogMode(gormLogLevel),
		// 禁用自动创建外键约束（SQLite 兼容性）
		DisableForeignKeyConstraintWhenMigrating: false,
		// 统一使用 UTC 时间
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}

	// SQLite DSN：启用 WAL 模式和外键约束
	// WAL 模式允许读写并发，大幅提升多操作场景性能
	dsn := fmt.Sprintf("%s?_journal_mode=WAL&_foreign_keys=ON", cfg.FilePath)

	db, err := gorm.Open(sqlite.Open(dsn), gormCfg)
	if err != nil {
		return nil, fmt.Errorf("打开 SQLite 数据库失败 [%s]: %w", cfg.FilePath, err)
	}

	// 配置连接池
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("获取底层 sql.DB 失败: %w", err)
	}

	maxIdle := cfg.MaxIdleConns
	if maxIdle <= 0 {
		maxIdle = 2
	}
	maxOpen := cfg.MaxOpenConns
	if maxOpen <= 0 {
		maxOpen = 10
	}

	sqlDB.SetMaxIdleConns(maxIdle)
	sqlDB.SetMaxOpenConns(maxOpen)
	// 连接最长存活时间，防止 SQLite 文件锁问题
	sqlDB.SetConnMaxLifetime(time.Hour)

	return db, nil
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

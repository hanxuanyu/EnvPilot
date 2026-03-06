// Package logger 提供全局统一日志能力。
//
// 设计目的：
//   - 封装 zap 日志库，提供简洁的全局日志接口
//   - 支持同时输出到控制台（开发模式）和文件（生产模式）
//   - 支持按日期自动滚动日志文件（lumberjack）
//   - 日志级别可通过配置动态调整
//
// 使用方式：
//
//	// 初始化（应用启动时调用一次）
//	logger.Init(logger.Config{Level: "info", FilePath: "logs/app.log"})
//
//	// 使用全局 logger
//	logger.Info("操作完成", zap.String("user", "admin"))
//	logger.Error("操作失败", zap.Error(err))
package logger

import (
	"os"
	"path/filepath"
	"strings"
	"sync"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/lumberjack.v2"
)

// Config 日志配置项
type Config struct {
	// Level 日志级别：debug / info / warn / error
	Level string
	// FilePath 日志文件路径，为空则只输出到控制台
	FilePath string
	// MaxSize 单个日志文件最大 MB
	MaxSize int
	// MaxBackups 保留历史日志文件数量
	MaxBackups int
	// MaxAge 历史日志保留天数
	MaxAge int
	// Compress 是否压缩历史日志
	Compress bool
}

var (
	// globalLogger 全局 zap logger 实例，通过 Init 初始化
	globalLogger *zap.Logger
	// sugar 语法糖版本，支持 printf 风格
	sugar  *zap.SugaredLogger
	once   sync.Once
	initMu sync.Mutex
)

// Init 初始化全局 logger，应在应用启动时调用一次。
// 支持重复调用（会替换现有实例）。
func Init(cfg Config) error {
	initMu.Lock()
	defer initMu.Unlock()

	level := parseLevel(cfg.Level)

	// 构建 encoder 配置（日志格式）
	encoderCfg := zapcore.EncoderConfig{
		TimeKey:        "time",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		MessageKey:     "msg",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.TimeEncoderOfLayout("2006-01-02 15:04:05.000"),
		EncodeDuration: zapcore.SecondsDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}

	var cores []zapcore.Core

	// 控制台输出：彩色，人类可读格式
	consoleEncoder := zapcore.NewConsoleEncoder(encoderCfg)
	consoleCore := zapcore.NewCore(
		consoleEncoder,
		zapcore.AddSync(os.Stdout),
		level,
	)
	cores = append(cores, consoleCore)

	// 文件输出：JSON 格式，便于日志采集
	if cfg.FilePath != "" {
		// 确保日志目录存在
		if err := os.MkdirAll(filepath.Dir(cfg.FilePath), 0755); err != nil {
			return err
		}

		maxSize := cfg.MaxSize
		if maxSize <= 0 {
			maxSize = 100
		}
		maxBackups := cfg.MaxBackups
		if maxBackups <= 0 {
			maxBackups = 7
		}
		maxAge := cfg.MaxAge
		if maxAge <= 0 {
			maxAge = 30
		}

		// lumberjack 负责日志文件滚动管理
		fileWriter := &lumberjack.Logger{
			Filename:   cfg.FilePath,
			MaxSize:    maxSize,
			MaxBackups: maxBackups,
			MaxAge:     maxAge,
			Compress:   cfg.Compress,
		}

		fileEncoder := zapcore.NewJSONEncoder(encoderCfg)
		fileCore := zapcore.NewCore(
			fileEncoder,
			zapcore.AddSync(fileWriter),
			level,
		)
		cores = append(cores, fileCore)
	}

	// 合并多个输出目标
	core := zapcore.NewTee(cores...)
	globalLogger = zap.New(core, zap.AddCaller(), zap.AddCallerSkip(1))
	sugar = globalLogger.Sugar()

	return nil
}

// parseLevel 将字符串日志级别转换为 zapcore.Level
func parseLevel(levelStr string) zapcore.Level {
	switch strings.ToLower(levelStr) {
	case "debug":
		return zapcore.DebugLevel
	case "warn", "warning":
		return zapcore.WarnLevel
	case "error":
		return zapcore.ErrorLevel
	default:
		return zapcore.InfoLevel
	}
}

// ensureInit 确保 logger 已初始化（懒初始化，使用默认配置）
func ensureInit() {
	once.Do(func() {
		if globalLogger == nil {
			_ = Init(Config{Level: "info"})
		}
	})
}

// Sync 刷新缓冲区，应在程序退出时调用
func Sync() {
	if globalLogger != nil {
		_ = globalLogger.Sync()
	}
}

// GetLogger 获取原始 zap.Logger 实例，供需要精细控制的场景使用
func GetLogger() *zap.Logger {
	ensureInit()
	return globalLogger
}

// ========== 快捷日志方法 ==========

func Debug(msg string, fields ...zap.Field) {
	ensureInit()
	globalLogger.Debug(msg, fields...)
}

func Info(msg string, fields ...zap.Field) {
	ensureInit()
	globalLogger.Info(msg, fields...)
}

func Warn(msg string, fields ...zap.Field) {
	ensureInit()
	globalLogger.Warn(msg, fields...)
}

func Error(msg string, fields ...zap.Field) {
	ensureInit()
	globalLogger.Error(msg, fields...)
}

func Fatal(msg string, fields ...zap.Field) {
	ensureInit()
	globalLogger.Fatal(msg, fields...)
}

// With 返回携带固定字段的子 logger，适合在模块中使用
func With(fields ...zap.Field) *zap.Logger {
	ensureInit()
	return globalLogger.With(fields...)
}

// Named 返回携带名称的子 logger，方便区分模块来源
func Named(name string) *zap.Logger {
	ensureInit()
	return globalLogger.Named(name)
}

// Sugar 返回语法糖版本，支持 printf 风格调用
func Sugar() *zap.SugaredLogger {
	ensureInit()
	return sugar
}

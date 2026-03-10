// Package main app.go — Wails 桌面模式的生命周期与 API 绑定层。
//
// 初始化逻辑已迁移至 internal/app/container.go（无 Wails 依赖），
// 以支持桌面 / 服务端双模式构建。
// 本文件只保留 Wails 专属代码：startup/domReady/shutdown 生命周期和顶层 API 方法。
package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"

	"EnvPilot/internal/app"
	assetAPI "EnvPilot/internal/asset/api"
	auditAPI "EnvPilot/internal/audit/api"
	authAPI "EnvPilot/internal/auth/api"
	configAPI "EnvPilot/internal/config/api"
	connectorAPI "EnvPilot/internal/connector/api"
	dnsAPI "EnvPilot/internal/dns/api"
	executorAPI "EnvPilot/internal/executor/api"
	healthAPI "EnvPilot/internal/health/api"
	"EnvPilot/pkg/buildinfo"
	"EnvPilot/pkg/hostinfo"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"go.uber.org/zap"

	"EnvPilot/pkg/logger"
)

// App Wails 应用主结构体，对前端暴露 API
type App struct {
	ctx          context.Context
	container    *app.Container
	AuthAPI      *authAPI.AuthAPI
	AssetAPI     *assetAPI.AssetAPI
	AuditAPI     *auditAPI.AuditAPI
	ConfigAPI    *configAPI.ConfigAPI
	ConnectorAPI *connectorAPI.ConnectorAPI
	DNSAPI       *dnsAPI.DNSAPI
	HealthAPI    *healthAPI.HealthAPI
	ExecutorAPI  *executorAPI.ExecutorAPI
}

// NewApp 创建应用实例（桌面模式入口）
func NewApp() (*App, error) {
	c, err := app.Bootstrap()
	if err != nil {
		return nil, err
	}
	return &App{
		container:    c,
		AuthAPI:      c.AuthAPI,
		AssetAPI:     c.AssetAPI,
		AuditAPI:     c.AuditAPI,
		ConfigAPI:    c.ConfigAPI,
		ConnectorAPI: c.ConnectorAPI,
		DNSAPI:       c.DNSAPI,
		HealthAPI:    c.HealthAPI,
		ExecutorAPI:  c.ExecutorAPI,
	}, nil
}

// ── Wails 生命周期 ────────────────────────────────────────────────

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.ConnectorAPI.SetContext(ctx)
	a.ExecutorAPI.SetContext(ctx)
	logger.Info("应用窗口已就绪")
}

func (a *App) domReady(ctx context.Context) {
	logger.Info("前端 DOM 就绪")
	// 通知前端桥接已就绪，解决页面刷新后竞争条件
	wailsruntime.EventsEmit(ctx, "backend:ready")
}

func (a *App) shutdown(ctx context.Context) {
	logger.Info("EnvPilot 正在关闭，清理资源...")
	a.container.Cleanup()
	logger.Info("所有资源已清理")
}

// ── 基础 API ──────────────────────────────────────────────────────

// Ping 连通性验证接口
func (a *App) Ping() string {
	return "pong"
}

// GetVersion 获取应用版本信息
func (a *App) GetVersion() map[string]string {
	cfg := a.container.Config.Get()
	logger.Info("获取版本信息",
		zap.String("version", buildinfo.NormalizedVersion()),
		zap.String("commit", buildinfo.NormalizedCommit()),
	)
	return map[string]string{
		"name":    cfg.App.Name,
		"version": buildinfo.NormalizedVersion(),
		"commit":  buildinfo.NormalizedCommit(),
	}
}

// GetHostInfo 获取当前主机资源与平台信息
func (a *App) GetHostInfo() hostinfo.Snapshot {
	return hostinfo.Collect()
}

type SaveExportFileReq struct {
	Filename          string `json:"filename"`
	DataBase64        string `json:"data_base64"`
	Title             string `json:"title"`
	FilterDisplayName string `json:"filter_display_name"`
	FilterPattern     string `json:"filter_pattern"`
}

// SaveExportFile 在桌面模式下弹出原生保存对话框并写入导出文件。
func (a *App) SaveExportFile(req SaveExportFileReq) (string, error) {
	if a.ctx == nil {
		return "", fmt.Errorf("应用上下文未初始化")
	}
	if req.Filename == "" {
		return "", fmt.Errorf("文件名不能为空")
	}
	if req.DataBase64 == "" {
		return "", fmt.Errorf("导出内容不能为空")
	}

	content, err := base64.StdEncoding.DecodeString(req.DataBase64)
	if err != nil {
		return "", fmt.Errorf("导出内容解码失败: %w", err)
	}

	options := wailsruntime.SaveDialogOptions{
		Title:                req.Title,
		DefaultFilename:      req.Filename,
		CanCreateDirectories: true,
	}
	if req.FilterDisplayName != "" && req.FilterPattern != "" {
		options.Filters = []wailsruntime.FileFilter{{
			DisplayName: req.FilterDisplayName,
			Pattern:     req.FilterPattern,
		}}
	}

	targetPath, err := wailsruntime.SaveFileDialog(a.ctx, options)
	if err != nil {
		return "", fmt.Errorf("打开保存对话框失败: %w", err)
	}
	if targetPath == "" {
		return "", nil
	}

	if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
		return "", fmt.Errorf("创建导出目录失败: %w", err)
	}
	if err := os.WriteFile(targetPath, content, 0644); err != nil {
		return "", fmt.Errorf("写入导出文件失败: %w", err)
	}

	logger.Info("导出文件已保存", zap.String("path", targetPath))
	return targetPath, nil
}

// Package main app.go — Wails 桌面模式的生命周期与 API 绑定层。
//
// 初始化逻辑已迁移至 internal/app/container.go（无 Wails 依赖），
// 以支持桌面 / 服务端双模式构建。
// 本文件只保留 Wails 专属代码：startup/domReady/shutdown 生命周期和顶层 API 方法。
package main

import (
	"context"

	"EnvPilot/internal/app"
	assetAPI "EnvPilot/internal/asset/api"
	executorAPI "EnvPilot/internal/executor/api"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"go.uber.org/zap"

	"EnvPilot/pkg/logger"
)

// App Wails 应用主结构体，对前端暴露 API
type App struct {
	ctx         context.Context
	container   *app.Container
	AssetAPI    *assetAPI.AssetAPI
	ExecutorAPI *executorAPI.ExecutorAPI
}

// NewApp 创建应用实例（桌面模式入口）
func NewApp() (*App, error) {
	c, err := app.Bootstrap()
	if err != nil {
		return nil, err
	}
	return &App{
		container:   c,
		AssetAPI:    c.AssetAPI,
		ExecutorAPI: c.ExecutorAPI,
	}, nil
}

// ── Wails 生命周期 ────────────────────────────────────────────────

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
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
	logger.Info("获取版本信息", zap.String("version", cfg.App.Version))
	return map[string]string{
		"name":    cfg.App.Name,
		"version": cfg.App.Version,
	}
}

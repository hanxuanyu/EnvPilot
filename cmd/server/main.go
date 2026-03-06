// EnvPilot 服务端模式入口
//
// 以纯 HTTP 服务启动，不依赖 Wails / WebView，适用于 Linux/macOS 服务器部署。
// 前端静态资源（server 模式构建产物）内嵌在二进制文件中。
//
// 使用方式：
//
//	./envpilot-server [--addr :8080]
//
// 构建方式（在项目根目录执行）：
//
//	make build-server
package main

import (
	"flag"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"EnvPilot/api"
	"EnvPilot/internal/app"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
)

func main() {
	addr := flag.String("addr", ":8080", "HTTP 监听地址，如 :8080 或 0.0.0.0:9000")
	flag.Parse()

	// ── 初始化所有业务模块 ──
	container, err := app.Bootstrap()
	if err != nil {
		println("初始化失败:", err.Error())
		os.Exit(1)
	}
	defer container.Cleanup()

	// ── 构建 HTTP 路由 ──
	router := api.NewRouter(container, getServerAssets())

	// ── 启动 HTTP 服务 ──
	server := &http.Server{
		Addr:    *addr,
		Handler: router,
	}

	logger.Info("EnvPilot 服务端模式启动", zap.String("addr", *addr))

	// 后台启动 HTTP 服务
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("HTTP 服务异常退出", zap.Error(err))
			os.Exit(1)
		}
	}()

	// 等待 SIGTERM / SIGINT 信号优雅退出
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("收到退出信号，正在关闭...")
	_ = server.Close()
}

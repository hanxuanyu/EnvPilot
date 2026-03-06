package main

import (
	"embed"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// 创建应用实例，所有模块依赖在 NewApp 中完成初始化
	app, err := NewApp()
	if err != nil {
		println("初始化应用失败:", err.Error())
		os.Exit(1)
	}

	// 启动 Wails 桌面应用
	err = wails.Run(&options.App{
		Title:  "EnvPilot",
		Width:  1440,
		Height: 900,
		MinWidth:  1024,
		MinHeight: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		// 深色背景与前端主题一致
		BackgroundColour: &options.RGBA{R: 15, G: 23, B: 42, A: 1},
		OnStartup:        app.startup,
		OnDomReady:       app.domReady,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
			app.AssetAPI,
			app.ExecutorAPI,
		},
		Windows: &windows.Options{
			// WebView2 渲染引擎，支持现代 Web 特性
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			DisableWindowIcon:    false,
		},
	})

	if err != nil {
		println("运行应用失败:", err.Error())
		os.Exit(1)
	}
}

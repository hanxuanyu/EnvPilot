package main

import (
	"embed"
	"io/fs"
)

// serverAssets 内嵌服务端模式构建的前端静态资源。
// 构建流程（Makefile 自动处理）：
//  1. npm run build:server --prefix frontend  → 产出 frontend/dist-server/
//  2. cp -r frontend/dist-server/. cmd/server/dist/
//  3. go build ./cmd/server/  → 内嵌此目录
//
//go:embed all:dist
var embeddedFS embed.FS

// getServerAssets 返回去掉 dist 前缀的文件系统，便于 http.FileServerFS 直接使用
func getServerAssets() fs.FS {
	sub, err := fs.Sub(embeddedFS, "dist")
	if err != nil {
		return embeddedFS
	}
	return sub
}

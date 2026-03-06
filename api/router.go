// Package api 提供服务端模式的 HTTP 路由和 handler。
//
// 路由完全基于标准库 net/http（Go 1.22+ 路径参数语法），
// 不引入 Wails 依赖，可独立编译为服务端二进制。
package api

import (
	"io/fs"
	"net/http"

	"EnvPilot/internal/app"
)

// NewRouter 创建 HTTP 路由。
//
// staticFiles 为内嵌的前端静态资源（server 模式构建产物），
// 当请求路径不匹配任何 API 路由时，返回 index.html（SPA fallback）。
func NewRouter(c *app.Container, staticFiles fs.FS) http.Handler {
	bus := NewEventBus()

	assetH := NewAssetHandler(c.EnvSvc, c.GrpSvc, c.AssetSvc, c.CredSvc)
	execH := NewExecutorHandler(c.ExecSvc, c.TermSvc, c.Pool, bus)

	mux := http.NewServeMux()

	// ── 基础 ──────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/ping", func(w http.ResponseWriter, r *http.Request) {
		writeOK(w, "pong")
	})
	mux.HandleFunc("GET /api/version", func(w http.ResponseWriter, r *http.Request) {
		cfg := c.Config.Get()
		writeOK(w, map[string]string{"name": cfg.App.Name, "version": cfg.App.Version})
	})

	// ── 插件 ──────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/plugins", assetH.ListPlugins)
	mux.HandleFunc("GET /api/plugins/{type}/schema", assetH.GetPluginSchema)

	// ── 环境 ──────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/environments", assetH.ListEnvironments)
	mux.HandleFunc("POST /api/environments", assetH.CreateEnvironment)
	mux.HandleFunc("PUT /api/environments/{id}", assetH.UpdateEnvironment)
	mux.HandleFunc("DELETE /api/environments/{id}", assetH.DeleteEnvironment)

	// ── 分组 ──────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/groups", assetH.ListGroups)
	mux.HandleFunc("POST /api/groups", assetH.CreateGroup)
	mux.HandleFunc("PUT /api/groups/{id}", assetH.UpdateGroup)
	mux.HandleFunc("DELETE /api/groups/{id}", assetH.DeleteGroup)

	// ── 资产 ──────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/assets", assetH.ListAssets)
	mux.HandleFunc("GET /api/assets/{id}", assetH.GetAsset)
	mux.HandleFunc("POST /api/assets", assetH.CreateAsset)
	mux.HandleFunc("PUT /api/assets/{id}", assetH.UpdateAsset)
	mux.HandleFunc("DELETE /api/assets/{id}", assetH.DeleteAsset)

	// ── 凭据 ──────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/credentials", assetH.ListCredentials)
	mux.HandleFunc("POST /api/credentials", assetH.CreateCredential)
	mux.HandleFunc("PUT /api/credentials/{id}", assetH.UpdateCredential)
	mux.HandleFunc("DELETE /api/credentials/{id}", assetH.DeleteCredential)
	mux.HandleFunc("POST /api/credentials/{id}/reveal", assetH.RevealCredential)

	// ── 命令执行 ──────────────────────────────────────────────────
	mux.HandleFunc("POST /api/executions", execH.ExecuteCommand)
	mux.HandleFunc("POST /api/executions/batch", execH.BatchExecuteCommand)
	mux.HandleFunc("GET /api/executions/{id}", execH.GetExecution)
	mux.HandleFunc("GET /api/executions", execH.ListExecutions)
	mux.HandleFunc("GET /api/executions/{id}/stream", execH.StreamExecution) // SSE
	mux.HandleFunc("POST /api/commands/check-dangerous", execH.CheckDangerousCommand)

	// ── 在线终端（WebSocket）──────────────────────────────────────
	mux.HandleFunc("GET /ws/terminal", execH.TerminalWS)

	// ── SPA fallback（前端静态资源）──────────────────────────────
	if staticFiles != nil {
		mux.Handle("/", spaHandler(http.FileServerFS(staticFiles)))
	}

	return corsMiddleware(mux)
}

// spaHandler 将所有非文件请求（如 /assets, /environments 等 SPA 路由）
// 映射到 index.html，保证浏览器刷新能正常加载 SPA。
func spaHandler(fileServer http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 如果请求以 /api 或 /ws 开头，不走 SPA fallback
		if len(r.URL.Path) >= 4 && (r.URL.Path[:4] == "/api" || r.URL.Path[:3] == "/ws") {
			http.NotFound(w, r)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}

// corsMiddleware 允许跨域请求（开发阶段前端与后端可能运行在不同端口）
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

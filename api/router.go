// Package api 提供服务端模式的 HTTP 路由和 handler。
//
// 路由完全基于标准库 net/http（Go 1.22+ 路径参数语法），
// 不引入 Wails 依赖，可独立编译为服务端二进制。
package api

import (
	"io/fs"
	"net/http"
	"strings"

	"EnvPilot/internal/app"
	"EnvPilot/pkg/buildinfo"
	"EnvPilot/pkg/hostinfo"
)

// NewRouter 创建 HTTP 路由。
//
// staticFiles 为内嵌的前端静态资源（server 模式构建产物），
// 当请求路径不匹配任何 API 路由时，返回 index.html（SPA fallback）。
func NewRouter(c *app.Container, staticFiles fs.FS) http.Handler {
	bus := NewEventBus()
	authz := NewAuthz(c.Auth)

	authH := NewAuthHandler(c.Auth)
	assetH := NewAssetHandler(c.EnvSvc, c.GrpSvc, c.AssetSvc, c.CredSvc)
	auditH := NewAuditHandler(c.AuditSvc)
	configH := NewConfigHandler(c.Config)
	connH := NewConnectorHandler(c.ConnSvc)
	dnsH := NewDNSHandler(c.DNSSvc)
	healthH := NewHealthHandler(c.HealthSvc)
	execH := NewExecutorHandler(c.ExecSvc, c.TermSvc, c.Pool, bus)

	mux := http.NewServeMux()

	// ── 基础 ──────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/ping", func(w http.ResponseWriter, r *http.Request) {
		writeOK(w, "pong")
	})
	mux.HandleFunc("GET /api/version", func(w http.ResponseWriter, r *http.Request) {
		cfg := c.Config.Get()
		writeOK(w, map[string]string{
			"name":    cfg.App.Name,
			"version": buildinfo.NormalizedVersion(),
			"commit":  buildinfo.NormalizedCommit(),
		})
	})
	mux.HandleFunc("GET /api/host/info", func(w http.ResponseWriter, r *http.Request) {
		writeOK(w, hostinfo.Collect())
	})
	mux.HandleFunc("GET /api/auth/status", authH.GetStatus)
	mux.HandleFunc("POST /api/auth/unlock", authH.Unlock)
	mux.HandleFunc("POST /api/auth/setup", authH.Setup)
	mux.HandleFunc("POST /api/auth/change-password", authH.ChangePassword)
	mux.HandleFunc("POST /api/auth/lock", authH.Lock)

	// ── 插件 ──────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/plugins", assetH.ListPlugins)
	mux.HandleFunc("GET /api/plugins/{type}/schema", assetH.GetPluginSchema)

	// ── 环境 ──────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/environments", assetH.ListEnvironments)
	mux.HandleFunc("POST /api/environments", authz.RequireAdmin(assetH.CreateEnvironment))
	mux.HandleFunc("PUT /api/environments/{id}", authz.RequireAdmin(assetH.UpdateEnvironment))
	mux.HandleFunc("DELETE /api/environments/{id}", authz.RequireAdmin(assetH.DeleteEnvironment))

	// ── 分组 ──────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/groups", assetH.ListGroups)
	mux.HandleFunc("POST /api/groups", authz.RequireAdmin(assetH.CreateGroup))
	mux.HandleFunc("PUT /api/groups/{id}", authz.RequireAdmin(assetH.UpdateGroup))
	mux.HandleFunc("DELETE /api/groups/{id}", authz.RequireAdmin(assetH.DeleteGroup))

	// ── 资产 ──────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/assets", assetH.ListAssets)
	mux.HandleFunc("GET /api/assets/{id}", assetH.GetAsset)
	mux.HandleFunc("POST /api/assets", authz.RequireAdmin(assetH.CreateAsset))
	mux.HandleFunc("PUT /api/assets/{id}", authz.RequireAdmin(assetH.UpdateAsset))
	mux.HandleFunc("DELETE /api/assets/{id}", authz.RequireAdmin(assetH.DeleteAsset))

	// ── 凭据 ──────────────────────────────────────────────────────
	mux.HandleFunc("GET /api/credentials", assetH.ListCredentials)
	mux.HandleFunc("GET /api/credentials/{id}/bindings", assetH.GetCredentialBindings)
	mux.HandleFunc("POST /api/credentials", authz.RequireAdmin(assetH.CreateCredential))
	mux.HandleFunc("PUT /api/credentials/{id}", authz.RequireAdmin(assetH.UpdateCredential))
	mux.HandleFunc("DELETE /api/credentials/{id}", authz.RequireAdmin(assetH.DeleteCredential))
	mux.HandleFunc("POST /api/credentials/{id}/reveal", authz.RequireAdmin(assetH.RevealCredential))

	// ── 中间件连接器 ───────────────────────────────────────────────
	mux.HandleFunc("POST /api/connectors/test", authz.RequireAdmin(connH.TestConnection))
	mux.HandleFunc("GET /api/connectors/{id}/catalog", authz.RequireAdmin(connH.GetDatabaseCatalog))
	mux.HandleFunc("GET /api/connectors/{id}/databases", authz.RequireAdmin(connH.ListDatabases))
	mux.HandleFunc("GET /api/connectors/{id}/tables", authz.RequireAdmin(connH.ListTables))
	mux.HandleFunc("POST /api/connectors/table-detail", authz.RequireAdmin(connH.GetTableDetail))
	mux.HandleFunc("POST /api/connectors/sql", authz.RequireAdmin(connH.ExecuteSQL))
	mux.HandleFunc("POST /api/connectors/redis", authz.RequireAdmin(connH.ExecuteRedisCmd))
	mux.HandleFunc("GET /api/connectors/{id}/cache/catalog", authz.RequireAdmin(connH.GetCacheCatalog))
	mux.HandleFunc("POST /api/connectors/cache/keys", authz.RequireAdmin(connH.ListCacheKeys))
	mux.HandleFunc("POST /api/connectors/cache/key-detail", authz.RequireAdmin(connH.GetCacheKeyDetail))
	mux.HandleFunc("POST /api/connectors/cache/key-save", authz.RequireAdmin(connH.SaveCacheKey))
	mux.HandleFunc("POST /api/connectors/cache/key-delete", authz.RequireAdmin(connH.DeleteCacheKey))
	mux.HandleFunc("POST /api/connectors/mq", authz.RequireAdmin(connH.SendMQMessage))
	mux.HandleFunc("GET /api/audits", authz.RequireProtectedPage(auditH.ListAuditLogs))
	mux.HandleFunc("GET /api/config", authz.RequireProtectedPage(configH.GetCurrent))
	mux.HandleFunc("PUT /api/config", authz.RequireAdmin(configH.Update))
	mux.HandleFunc("GET /api/config/snapshots", authz.RequireProtectedPage(configH.ListSnapshots))
	mux.HandleFunc("GET /api/config/snapshots/{id}", authz.RequireProtectedPage(configH.GetSnapshot))
	mux.HandleFunc("POST /api/config/rollback", authz.RequireAdmin(configH.Rollback))
	mux.HandleFunc("GET /api/dns/records", dnsH.ListRecords)
	mux.HandleFunc("GET /api/dns/records/by-asset/{asset_id}", dnsH.GetRecordByAssetID)
	mux.HandleFunc("POST /api/dns/records", authz.RequireAdmin(dnsH.CreateRecord))
	mux.HandleFunc("PUT /api/dns/records/{id}", authz.RequireAdmin(dnsH.UpdateRecord))
	mux.HandleFunc("DELETE /api/dns/records/{id}", authz.RequireAdmin(dnsH.DeleteRecord))
	mux.HandleFunc("POST /api/dns/records/{id}/enabled", authz.RequireAdmin(dnsH.SetRecordEnabled))
	mux.HandleFunc("GET /api/dns/logs", dnsH.ListQueryLogs)
	mux.HandleFunc("GET /api/dns/status", dnsH.GetStatus)
	mux.HandleFunc("GET /api/health/snapshots", healthH.ListSnapshots)
	mux.HandleFunc("GET /api/health/summary", healthH.GetSummary)
	mux.HandleFunc("POST /api/health/check/{asset_id}", authz.RequireAdmin(healthH.CheckAsset))
	mux.HandleFunc("POST /api/health/check-all", authz.RequireAdmin(healthH.CheckAll))

	// ── 命令执行 ──────────────────────────────────────────────────
	mux.HandleFunc("POST /api/executions", authz.RequireAdmin(execH.ExecuteCommand))
	mux.HandleFunc("POST /api/executions/batch", authz.RequireAdmin(execH.BatchExecuteCommand))
	mux.HandleFunc("GET /api/executions/{id}", authz.RequireAdmin(execH.GetExecution))
	mux.HandleFunc("GET /api/executions", authz.RequireAdmin(execH.ListExecutions))
	mux.HandleFunc("GET /api/executions/{id}/stream", authz.RequireAdmin(execH.StreamExecution)) // SSE
	mux.HandleFunc("POST /api/commands/check-dangerous", authz.RequireAdmin(execH.CheckDangerousCommand))

	// ── 在线终端（WebSocket）──────────────────────────────────────
	mux.HandleFunc("GET /ws/terminal", authz.RequireAdmin(execH.TerminalWS))

	// ── SPA fallback（前端静态资源）──────────────────────────────
	if staticFiles != nil {
		mux.Handle("/", spaHandler(staticFiles))
	}

	return corsMiddleware(mux)
}

// spaHandler 处理前端静态资源和 SPA 路由 fallback。
//
// 逻辑：
//   - 请求路径对应实际文件（JS/CSS/图片等）→ 直接返回文件
//   - 请求路径不存在对应文件（/assets, /environments 等 SPA 路由）→ 返回 index.html
//
// 这样浏览器直接刷新任意 SPA 路由时，React Router 能正确接管渲染。
func spaHandler(staticFiles fs.FS) http.Handler {
	fileServer := http.FileServerFS(staticFiles)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uPath := strings.TrimPrefix(r.URL.Path, "/")

		// 根路径直接交给 fileServer（返回 index.html）
		if uPath == "" {
			fileServer.ServeHTTP(w, r)
			return
		}

		// 静态文件存在则直接返回
		if _, err := fs.Stat(staticFiles, uPath); err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}

		// 文件不存在 → SPA fallback：返回 index.html，由 React Router 处理路由
		indexContent, err := fs.ReadFile(staticFiles, "index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(indexContent)
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

package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"EnvPilot/internal/executor/repository"
	execSvc "EnvPilot/internal/executor/service"
	sshpkg "EnvPilot/internal/executor/ssh"
	"EnvPilot/pkg/event"
	"EnvPilot/pkg/logger"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
	// 服务端模式允许所有跨域来源（按需收紧）
	CheckOrigin: func(r *http.Request) bool { return true },
}

// ExecutorHandler 命令执行 + 在线终端 HTTP handler
type ExecutorHandler struct {
	execSvc *execSvc.ExecutorService
	termSvc *execSvc.TerminalService
	pool    *sshpkg.Pool
	bus     *EventBus
	log     *zap.Logger
}

func NewExecutorHandler(
	es *execSvc.ExecutorService,
	ts *execSvc.TerminalService,
	pool *sshpkg.Pool,
	bus *EventBus,
) *ExecutorHandler {
	return &ExecutorHandler{
		execSvc: es,
		termSvc: ts,
		pool:    pool,
		bus:     bus,
		log:     logger.Named("executor_handler"),
	}
}

// ── 命令执行 ──────────────────────────────────────────────────────

// POST /api/executions
func (h *ExecutorHandler) ExecuteCommand(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AssetID  uint   `json:"asset_id"`
		Command  string `json:"command"`
		Operator string `json:"operator"`
		Force    bool   `json:"force"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}

	result, err := h.execSvc.Execute(r.Context(), execSvc.ExecuteRequest{
		AssetID:  req.AssetID,
		Command:  req.Command,
		Operator: req.Operator,
		Force:    req.Force,
	}, &BusEmitter{Bus: h.bus})

	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, map[string]interface{}{
		"dangerous": result.Dangerous,
		"execution": result.Execution,
	})
}

// POST /api/executions/batch
func (h *ExecutorHandler) BatchExecuteCommand(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AssetIDs []uint `json:"asset_ids"`
		Command  string `json:"command"`
		Operator string `json:"operator"`
		Force    bool   `json:"force"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}

	results, err := h.execSvc.BatchExecute(r.Context(), execSvc.BatchExecuteRequest{
		AssetIDs: req.AssetIDs,
		Command:  req.Command,
		Operator: req.Operator,
		Force:    req.Force,
	}, &BusEmitter{Bus: h.bus})

	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}

	if len(results) == 1 && results[0].Dangerous {
		writeOK(w, map[string]interface{}{"dangerous": true, "results": nil})
		return
	}

	items := make([]map[string]interface{}, 0, len(results))
	for _, res := range results {
		items = append(items, map[string]interface{}{
			"dangerous": res.Dangerous,
			"execution": res.Execution,
		})
	}
	writeOK(w, map[string]interface{}{"dangerous": false, "results": items})
}

// GET /api/executions/{id}
func (h *ExecutorHandler) GetExecution(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}
	exec, err := h.execSvc.GetExecution(id)
	if err != nil {
		writeFail(w, http.StatusNotFound, err.Error())
		return
	}
	writeOK(w, exec)
}

// GET /api/executions?asset_id=&page=&page_size=
func (h *ExecutorHandler) ListExecutions(w http.ResponseWriter, r *http.Request) {
	list, total, err := h.execSvc.ListExecutions(repository.ExecutionQuery{
		AssetID:  queryUint(r, "asset_id"),
		Page:     queryInt(r, "page", 1),
		PageSize: queryInt(r, "page_size", 20),
	})
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, map[string]interface{}{"list": list, "total": total})
}

// POST /api/commands/check-dangerous
func (h *ExecutorHandler) CheckDangerousCommand(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Command string `json:"command"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	writeOK(w, sshpkg.IsDangerous(req.Command))
}

// GET /api/executions/{id}/stream  (SSE)
//
// 实时推送命令输出。若命令已执行完毕，直接从数据库读取结果返回。
func (h *ExecutorHandler) StreamExecution(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}

	// 先检查是否已完成（快速命令可能在 SSE 订阅前就执行完了）
	exec, dbErr := h.execSvc.GetExecution(id)
	if dbErr == nil && exec.Status != "running" {
		// 直接输出已完成的执行结果
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		sseEvent(w, "done", map[string]interface{}{
			"exec_id":   exec.ID,
			"exit_code": exec.ExitCode,
			"status":    exec.Status,
			"output":    exec.Output,
		})
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
		return
	}

	// 订阅实时事件
	outTopic := fmt.Sprintf("executor:output:%d", id)
	doneTopic := fmt.Sprintf("executor:done:%d", id)

	outCh, unsubOut := h.bus.Subscribe(outTopic, 64)
	doneCh, unsubDone := h.bus.Subscribe(doneTopic, 1)
	defer unsubOut()
	defer unsubDone()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeFail(w, http.StatusInternalServerError, "不支持 SSE")
		return
	}

	for {
		select {
		case msg, open := <-outCh:
			if !open {
				return
			}
			sseEvent(w, "output", msg.Data)
			flusher.Flush()

		case msg, open := <-doneCh:
			if !open {
				return
			}
			sseEvent(w, "done", msg.Data)
			flusher.Flush()
			return

		case <-r.Context().Done():
			return
		}
	}
}

// sseEvent 写入一条 SSE 事件
func sseEvent(w http.ResponseWriter, eventType string, data interface{}) {
	b, _ := json.Marshal(map[string]interface{}{"type": eventType, "data": data})
	fmt.Fprintf(w, "data: %s\n\n", b)
}

// ── 在线终端（WebSocket）─────────────────────────────────────────

// GET /ws/terminal?asset_id=N
//
// WebSocket 协议（JSON framing）：
//
// 服务端 → 客户端:
//
//	{"type":"started","session_id":"xxx"}
//	{"type":"output","data":"<base64>"}
//	{"type":"closed"}
//	{"type":"error","message":"..."}
//
// 客户端 → 服务端:
//
//	{"type":"input","data":"..."}
//	{"type":"resize","cols":80,"rows":24}
//	{"type":"close"}
func (h *ExecutorHandler) TerminalWS(w http.ResponseWriter, r *http.Request) {
	assetID := queryUint(r, "asset_id")
	if assetID == 0 {
		http.Error(w, "缺少 asset_id 参数", http.StatusBadRequest)
		return
	}

	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		h.log.Warn("WebSocket 升级失败", zap.Error(err))
		return
	}
	defer conn.Close()

	// wsEmitter 将终端事件写入 WebSocket 连接
	emitter := &wsTerminalEmitter{conn: conn}

	sessionID, err := h.termSvc.StartTerminal(assetID, emitter)
	if err != nil {
		h.log.Warn("启动终端失败", zap.Uint("assetID", assetID), zap.Error(err))
		_ = conn.WriteJSON(map[string]interface{}{"type": "error", "message": err.Error()})
		return
	}

	// 通知客户端会话已建立
	if err := conn.WriteJSON(map[string]interface{}{
		"type":       "started",
		"session_id": sessionID,
	}); err != nil {
		return
	}

	// 读取客户端输入并转发到 SSH
	for {
		_, rawMsg, err := conn.ReadMessage()
		if err != nil {
			// 客户端断开，关闭终端
			h.termSvc.CloseTerminal(sessionID)
			break
		}

		var msg struct {
			Type string `json:"type"`
			Data string `json:"data"`
			Cols uint32 `json:"cols"`
			Rows uint32 `json:"rows"`
		}
		if jsonErr := json.Unmarshal(rawMsg, &msg); jsonErr != nil {
			continue
		}

		switch msg.Type {
		case "input":
			if sendErr := h.termSvc.SendInput(sessionID, msg.Data); sendErr != nil {
				h.log.Warn("发送输入失败", zap.String("sessionID", sessionID), zap.Error(sendErr))
			}
		case "resize":
			if msg.Cols > 0 && msg.Rows > 0 {
				_ = h.termSvc.ResizeTerminal(sessionID, msg.Cols, msg.Rows)
			}
		case "close":
			h.termSvc.CloseTerminal(sessionID)
			return
		}
	}
}

// wsTerminalEmitter 将终端 Emitter 事件写入 WebSocket 连接
type wsTerminalEmitter struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (e *wsTerminalEmitter) Emit(ev string, data interface{}) {
	e.mu.Lock()
	defer e.mu.Unlock()

	var msg map[string]interface{}
	switch {
	case len(ev) > 16 && ev[:16] == "terminal:output:":
		msg = map[string]interface{}{"type": "output", "data": data}
	case len(ev) > 16 && ev[:16] == "terminal:closed:":
		msg = map[string]interface{}{"type": "closed"}
	default:
		return
	}
	_ = e.conn.WriteJSON(msg)
}

// Ensure wsTerminalEmitter implements event.Emitter
var _ event.Emitter = (*wsTerminalEmitter)(nil)

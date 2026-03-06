package executorapi

import (
	"context"

	execModel "EnvPilot/internal/executor/model"
	"EnvPilot/internal/executor/repository"
	"EnvPilot/internal/executor/service"
	sshpkg "EnvPilot/internal/executor/ssh"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
)

// ExecutorAPI 执行器模块的 Wails 绑定结构体
// 对前端暴露 SSH 命令执行和在线终端功能
type ExecutorAPI struct {
	ctx     context.Context // 由 SetContext 在 startup 阶段注入，用于 Wails 事件推送
	execSvc *service.ExecutorService
	termSvc *service.TerminalService
	pool    *sshpkg.Pool
	log     *zap.Logger
}

// NewExecutorAPI 创建 ExecutorAPI，注入所有依赖
func NewExecutorAPI(
	execSvc *service.ExecutorService,
	termSvc *service.TerminalService,
	pool *sshpkg.Pool,
) *ExecutorAPI {
	return &ExecutorAPI{
		execSvc: execSvc,
		termSvc: termSvc,
		pool:    pool,
		log:     logger.Named("executor_api"),
	}
}

// SetContext 在 Wails startup 阶段由 App 调用，注入运行时 context（用于事件推送）
func (a *ExecutorAPI) SetContext(ctx context.Context) {
	a.ctx = ctx
}

// Cleanup 关闭所有终端会话和 SSH 连接（应用退出时调用）
func (a *ExecutorAPI) Cleanup() {
	a.termSvc.CloseAll()
	a.pool.CloseAll()
}

// ==================== 命令执行 ====================

// ExecuteCommandReq 单条命令执行请求
type ExecuteCommandReq struct {
	AssetID  uint   `json:"asset_id"`
	Command  string `json:"command"`
	Operator string `json:"operator"`
	Force    bool   `json:"force"` // true = 跳过危险命令检查
}

// ExecuteResult 执行结果
type ExecuteResult struct {
	Dangerous bool                 `json:"dangerous"`
	Execution *execModel.Execution `json:"execution,omitempty"`
}

// ExecuteCommand 在单个资产上执行命令（异步，立即返回执行记录）
//
// 实时事件通过 a.ctx（startup 阶段注入）推送给前端：
//   - executor:output:{id}  → 命令输出流
//   - executor:done:{id}    → 执行完成
func (a *ExecutorAPI) ExecuteCommand(req ExecuteCommandReq) Result[ExecuteResult] {
	result, err := a.execSvc.Execute(a.ctx, service.ExecuteRequest{
		AssetID:  req.AssetID,
		Command:  req.Command,
		Operator: req.Operator,
		Force:    req.Force,
	})
	if err != nil {
		a.log.Warn("执行命令失败", zap.Error(err))
		return Fail[ExecuteResult](err.Error())
	}
	return OK(ExecuteResult{
		Dangerous: result.Dangerous,
		Execution: result.Execution,
	})
}

// BatchExecuteReq 批量命令执行请求
type BatchExecuteReq struct {
	AssetIDs []uint `json:"asset_ids"`
	Command  string `json:"command"`
	Operator string `json:"operator"`
	Force    bool   `json:"force"`
}

// BatchExecuteResult 批量执行结果
type BatchExecuteResult struct {
	Results   []ExecuteResult `json:"results"`
	Dangerous bool            `json:"dangerous"`
}

// BatchExecuteCommand 在多个资产上并发执行命令
func (a *ExecutorAPI) BatchExecuteCommand(req BatchExecuteReq) Result[BatchExecuteResult] {
	results, err := a.execSvc.BatchExecute(a.ctx, service.BatchExecuteRequest{
		AssetIDs: req.AssetIDs,
		Command:  req.Command,
		Operator: req.Operator,
		Force:    req.Force,
	})
	if err != nil {
		return Fail[BatchExecuteResult](err.Error())
	}

	// 检查是否因危险命令中止
	if len(results) == 1 && results[0].Dangerous {
		return OK(BatchExecuteResult{Dangerous: true})
	}

	items := make([]ExecuteResult, 0, len(results))
	for _, r := range results {
		items = append(items, ExecuteResult{
			Dangerous: r.Dangerous,
			Execution: r.Execution,
		})
	}
	return OK(BatchExecuteResult{Results: items})
}

// GetExecution 获取单条执行记录详情
func (a *ExecutorAPI) GetExecution(id uint) Result[*execModel.Execution] {
	exec, err := a.execSvc.GetExecution(id)
	if err != nil {
		return Fail[*execModel.Execution](err.Error())
	}
	return OK(exec)
}

// ListExecutionsReq 执行记录查询请求
type ListExecutionsReq struct {
	AssetID  uint   `json:"asset_id"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
}

// ExecutionListResult 执行记录列表结果
type ExecutionListResult struct {
	List  []execModel.Execution `json:"list"`
	Total int64                 `json:"total"`
}

// ListExecutions 分页查询执行记录
func (a *ExecutorAPI) ListExecutions(req ListExecutionsReq) Result[ExecutionListResult] {
	list, total, err := a.execSvc.ListExecutions(repository.ExecutionQuery{
		AssetID:  req.AssetID,
		Page:     req.Page,
		PageSize: req.PageSize,
	})
	if err != nil {
		return Fail[ExecutionListResult](err.Error())
	}
	return OK(ExecutionListResult{List: list, Total: total})
}

// CheckDangerousCommand 检查命令是否为高危命令
func (a *ExecutorAPI) CheckDangerousCommand(command string) Result[bool] {
	return OK(sshpkg.IsDangerous(command))
}

// ==================== 在线终端 ====================

// StartTerminal 启动一个 SSH PTY 终端会话，返回 sessionID
//
// 终端事件通过 a.ctx（startup 阶段注入）推送给前端：
//   - terminal:output:{sessionId}  → base64 编码的终端输出
//   - terminal:closed:{sessionId}  → 会话关闭通知
func (a *ExecutorAPI) StartTerminal(assetId uint) Result[string] {
	sessionID, err := a.termSvc.StartTerminal(a.ctx, assetId)
	if err != nil {
		a.log.Warn("启动终端会话失败", zap.Uint("assetId", assetId), zap.Error(err))
		return Fail[string](err.Error())
	}
	return OK(sessionID)
}

// TerminalInput 向终端会话发送键盘输入
func (a *ExecutorAPI) TerminalInput(sessionId, data string) Result[bool] {
	if err := a.termSvc.SendInput(sessionId, data); err != nil {
		return Fail[bool](err.Error())
	}
	return OK(true)
}

// ResizeTerminal 调整终端窗口尺寸
func (a *ExecutorAPI) ResizeTerminal(sessionId string, cols, rows uint32) Result[bool] {
	if err := a.termSvc.ResizeTerminal(sessionId, cols, rows); err != nil {
		return Fail[bool](err.Error())
	}
	return OK(true)
}

// CloseTerminal 关闭终端会话
func (a *ExecutorAPI) CloseTerminal(sessionId string) Result[bool] {
	a.termSvc.CloseTerminal(sessionId)
	return OK(true)
}

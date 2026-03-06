// Package service 提供 SSH 命令执行业务逻辑。
package service

import (
	"bytes"
	"context"
	"fmt"
	"time"

	assetRepo "EnvPilot/internal/asset/repository"
	execModel "EnvPilot/internal/executor/model"
	"EnvPilot/internal/executor/repository"
	sshpkg "EnvPilot/internal/executor/ssh"
	"EnvPilot/pkg/logger"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.uber.org/zap"
	gossh "golang.org/x/crypto/ssh"
)

// ExecutorService SSH 命令执行服务
type ExecutorService struct {
	pool      *sshpkg.Pool
	execRepo  *repository.ExecutionRepo
	assetRepo *assetRepo.AssetRepo
	log       *zap.Logger
}

// NewExecutorService 创建执行服务
func NewExecutorService(
	pool *sshpkg.Pool,
	execRepo *repository.ExecutionRepo,
	ar *assetRepo.AssetRepo,
) *ExecutorService {
	return &ExecutorService{
		pool:      pool,
		execRepo:  execRepo,
		assetRepo: ar,
		log:       logger.Named("executor"),
	}
}

// ExecuteRequest 单条命令执行请求参数
type ExecuteRequest struct {
	AssetID  uint
	Command  string
	Operator string
	Force    bool // 跳过危险命令检查
}

// ExecuteResult 执行结果
type ExecuteResult struct {
	Dangerous bool                 `json:"dangerous"`            // 是否触发危险命令检测
	Execution *execModel.Execution `json:"execution,omitempty"` // 执行记录（Dangerous=true 时为 nil）
}

// Execute 在目标资产上异步执行命令
//
// 立即返回 Execution 记录（status=running），实际执行在后台 goroutine 中进行。
// 输出通过 Wails 事件 executor:output:{id} 实时推送，完成时触发 executor:done:{id}。
func (s *ExecutorService) Execute(ctx context.Context, req ExecuteRequest) (*ExecuteResult, error) {
	if !req.Force && sshpkg.IsDangerous(req.Command) {
		return &ExecuteResult{Dangerous: true}, nil
	}

	asset, err := s.assetRepo.FindByID(req.AssetID)
	if err != nil {
		return nil, fmt.Errorf("资产不存在 [id=%d]", req.AssetID)
	}

	operator := req.Operator
	if operator == "" {
		operator = "admin"
	}

	exec := &execModel.Execution{
		AssetID:   req.AssetID,
		AssetName: asset.Name,
		AssetHost: asset.Host,
		Command:   req.Command,
		Status:    execModel.ExecutionStatusRunning,
		Operator:  operator,
		StartedAt: time.Now(),
	}
	if err := s.execRepo.Create(exec); err != nil {
		return nil, fmt.Errorf("创建执行记录失败: %w", err)
	}

	go s.runCommand(ctx, exec, req.Command)

	return &ExecuteResult{Execution: exec}, nil
}

// BatchExecuteRequest 批量执行请求参数
type BatchExecuteRequest struct {
	AssetIDs []uint
	Command  string
	Operator string
	Force    bool
}

// BatchExecute 在多个资产上并发执行同一命令
func (s *ExecutorService) BatchExecute(ctx context.Context, req BatchExecuteRequest) ([]*ExecuteResult, error) {
	if !req.Force && sshpkg.IsDangerous(req.Command) {
		return []*ExecuteResult{{Dangerous: true}}, nil
	}

	results := make([]*ExecuteResult, 0, len(req.AssetIDs))
	for _, assetID := range req.AssetIDs {
		r, err := s.Execute(ctx, ExecuteRequest{
			AssetID:  assetID,
			Command:  req.Command,
			Operator: req.Operator,
			Force:    true, // 已在上层检查
		})
		if err != nil {
			s.log.Warn("批量执行单项失败", zap.Uint("assetID", assetID), zap.Error(err))
			results = append(results, &ExecuteResult{
				Execution: &execModel.Execution{
					AssetID: assetID,
					Command: req.Command,
					Status:  execModel.ExecutionStatusFailed,
					Output:  err.Error(),
				},
			})
			continue
		}
		results = append(results, r)
	}
	return results, nil
}

// GetExecution 获取单条执行记录
func (s *ExecutorService) GetExecution(id uint) (*execModel.Execution, error) {
	return s.execRepo.FindByID(id)
}

// ListExecutions 分页查询执行记录
func (s *ExecutorService) ListExecutions(q repository.ExecutionQuery) ([]execModel.Execution, int64, error) {
	return s.execRepo.List(q)
}

// runCommand 在后台 goroutine 中执行 SSH 命令并流式推送输出
func (s *ExecutorService) runCommand(ctx context.Context, exec *execModel.Execution, command string) {
	execID := exec.ID
	eventOutput := fmt.Sprintf("executor:output:%d", execID)
	eventDone := fmt.Sprintf("executor:done:%d", execID)

	defer func() {
		if r := recover(); r != nil {
			s.log.Error("执行 goroutine panic", zap.Uint("execID", execID), zap.Any("panic", r))
		}
	}()

	client, err := s.pool.GetClient(exec.AssetID)
	if err != nil {
		s.finishWithError(execID, err.Error())
		runtime.EventsEmit(ctx, eventDone, map[string]interface{}{
			"exec_id": execID, "exit_code": -1,
			"status": execModel.ExecutionStatusFailed, "message": err.Error(),
		})
		return
	}

	session, err := client.NewSession()
	if err != nil {
		// 连接可能已断开，移除缓存并重试一次
		s.pool.Remove(exec.AssetID)
		client, err = s.pool.GetClient(exec.AssetID)
		if err != nil {
			s.finishWithError(execID, err.Error())
			runtime.EventsEmit(ctx, eventDone, map[string]interface{}{
				"exec_id": execID, "exit_code": -1,
				"status": execModel.ExecutionStatusFailed,
			})
			return
		}
		session, err = client.NewSession()
		if err != nil {
			s.finishWithError(execID, err.Error())
			return
		}
	}
	defer session.Close()

	var buf bytes.Buffer
	sw := &streamWriter{buf: &buf, ctx: ctx, event: eventOutput}
	session.Stdout = sw
	session.Stderr = sw

	exitCode := 0
	status := execModel.ExecutionStatusSuccess
	if runErr := session.Run(command); runErr != nil {
		exitCode = 1
		if exitErr, ok := runErr.(*gossh.ExitError); ok {
			exitCode = exitErr.ExitStatus()
		}
		status = execModel.ExecutionStatusFailed
	}

	output := buf.String()
	if err := s.execRepo.Finish(execID, status, output, exitCode); err != nil {
		s.log.Error("更新执行记录失败", zap.Uint("execID", execID), zap.Error(err))
	}

	runtime.EventsEmit(ctx, eventDone, map[string]interface{}{
		"exec_id":   execID,
		"exit_code": exitCode,
		"status":    status,
		"output":    output,
	})

	s.log.Info("命令执行完成",
		zap.Uint("execID", execID),
		zap.Int("exitCode", exitCode),
		zap.String("status", string(status)),
	)
}

// finishWithError 快速标记执行为失败状态
func (s *ExecutorService) finishWithError(execID uint, message string) {
	if err := s.execRepo.Finish(execID, execModel.ExecutionStatusFailed, message, -1); err != nil {
		s.log.Error("更新执行记录失败", zap.Uint("execID", execID), zap.Error(err))
	}
}

// streamWriter 实时流式写入器：同时写入 buffer 并向前端推送事件
type streamWriter struct {
	buf   *bytes.Buffer
	ctx   context.Context
	event string
}

func (w *streamWriter) Write(p []byte) (n int, err error) {
	n, err = w.buf.Write(p)
	if n > 0 {
		runtime.EventsEmit(w.ctx, w.event, string(p[:n]))
	}
	return
}

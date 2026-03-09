// Package service 提供 SSH 命令执行业务逻辑。
package service

import (
	"bytes"
	"context"
	"fmt"
	"time"

	assetRepo "EnvPilot/internal/asset/repository"
	auditSvc "EnvPilot/internal/audit/service"
	execModel "EnvPilot/internal/executor/model"
	"EnvPilot/internal/executor/repository"
	sshpkg "EnvPilot/internal/executor/ssh"
	"EnvPilot/pkg/event"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
	gossh "golang.org/x/crypto/ssh"
)

// ExecutorService SSH 命令执行服务
type ExecutorService struct {
	pool      *sshpkg.Pool
	execRepo  *repository.ExecutionRepo
	assetRepo *assetRepo.AssetRepo
	audit     *auditSvc.AuditService
	log       *zap.Logger
}

// NewExecutorService 创建执行服务
func NewExecutorService(
	pool *sshpkg.Pool,
	execRepo *repository.ExecutionRepo,
	ar *assetRepo.AssetRepo,
	audit *auditSvc.AuditService,
) *ExecutorService {
	return &ExecutorService{
		pool:      pool,
		execRepo:  execRepo,
		assetRepo: ar,
		audit:     audit,
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
// 输出通过 emitter 实时推送事件：
//   - executor:output:{id}  → 命令输出流（chunk string）
//   - executor:done:{id}    → 执行完成（map 含 exit_code/status/output）
func (s *ExecutorService) Execute(ctx context.Context, req ExecuteRequest, emitter event.Emitter) (*ExecuteResult, error) {
	if !req.Force && sshpkg.IsDangerous(req.Command) {
		s.recordAudit(auditSvc.RecordInput{
			Module:       "executor",
			Action:       "block_dangerous_command",
			ResourceType: "asset",
			ResourceID:   uintPtr(req.AssetID),
			Operator:     operatorName(req.Operator),
			Success:      false,
			Detail:       "命中高危命令规则，已阻止执行",
			Request: map[string]any{
				"asset_id": req.AssetID,
				"command":  req.Command,
			},
		})
		return &ExecuteResult{Dangerous: true}, nil
	}

	asset, err := s.assetRepo.FindByID(req.AssetID)
	if err != nil {
		s.recordAudit(auditSvc.RecordInput{
			Module:       "executor",
			Action:       "execute_command",
			ResourceType: "asset",
			ResourceID:   uintPtr(req.AssetID),
			Operator:     operatorName(req.Operator),
			Success:      false,
			Detail:       fmt.Sprintf("资产不存在 [id=%d]", req.AssetID),
			Request: map[string]any{
				"asset_id": req.AssetID,
				"command":  req.Command,
			},
		})
		return nil, fmt.Errorf("资产不存在 [id=%d]", req.AssetID)
	}

	operator := req.Operator
	if operator == "" {
		operator = "admin"
	}

	exec := &execModel.Execution{
		AssetID:   req.AssetID,
		AssetName: asset.Name,
		AssetHost: asset.ExtConfig.GetString("host"),
		Command:   req.Command,
		Status:    execModel.ExecutionStatusRunning,
		Operator:  operator,
		StartedAt: time.Now(),
	}
	if err := s.execRepo.Create(exec); err != nil {
		s.recordAudit(auditSvc.RecordInput{
			Module:       "executor",
			Action:       "execute_command",
			ResourceType: "asset",
			ResourceID:   uintPtr(req.AssetID),
			ResourceName: asset.Name,
			PluginType:   asset.PluginType,
			Operator:     operator,
			Success:      false,
			Detail:       fmt.Sprintf("创建执行记录失败: %v", err),
			Request: map[string]any{
				"asset_id": req.AssetID,
				"command":  req.Command,
			},
		})
		return nil, fmt.Errorf("创建执行记录失败: %w", err)
	}

	go s.runCommand(emitter, exec, req.Command)

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
func (s *ExecutorService) BatchExecute(ctx context.Context, req BatchExecuteRequest, emitter event.Emitter) ([]*ExecuteResult, error) {
	if !req.Force && sshpkg.IsDangerous(req.Command) {
		s.recordAudit(auditSvc.RecordInput{
			Module:       "executor",
			Action:       "batch_execute_command",
			ResourceType: "asset",
			Operator:     operatorName(req.Operator),
			Success:      false,
			Detail:       "批量命令执行命中高危命令规则，已阻止执行",
			Request: map[string]any{
				"asset_ids": req.AssetIDs,
				"command":   req.Command,
			},
		})
		return []*ExecuteResult{{Dangerous: true}}, nil
	}

	results := make([]*ExecuteResult, 0, len(req.AssetIDs))
	failedDispatch := 0
	for _, assetID := range req.AssetIDs {
		r, err := s.Execute(ctx, ExecuteRequest{
			AssetID:  assetID,
			Command:  req.Command,
			Operator: req.Operator,
			Force:    true, // 已在上层检查
		}, emitter)
		if err != nil {
			s.log.Warn("批量执行单项失败", zap.Uint("assetID", assetID), zap.Error(err))
			failedDispatch++
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
	s.recordAudit(auditSvc.RecordInput{
		Module:       "executor",
		Action:       "batch_execute_command",
		ResourceType: "asset",
		Operator:     operatorName(req.Operator),
		Success:      true,
		Detail:       fmt.Sprintf("批量命令执行已下发：目标 %d，失败 %d", len(req.AssetIDs), failedDispatch),
		Request: map[string]any{
			"asset_ids": req.AssetIDs,
			"command":   req.Command,
		},
		Result: map[string]any{
			"requested":       len(req.AssetIDs),
			"failed_dispatch": failedDispatch,
		},
	})
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
func (s *ExecutorService) runCommand(emitter event.Emitter, exec *execModel.Execution, command string) {
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
		assetName, pluginType := s.assetAuditContext(exec.AssetID)
		s.recordAudit(auditSvc.RecordInput{
			Module:       "executor",
			Action:       "execute_command",
			ResourceType: "asset",
			ResourceID:   uintPtr(exec.AssetID),
			ResourceName: firstNonEmpty(exec.AssetName, assetName),
			PluginType:   pluginType,
			Operator:     operatorName(exec.Operator),
			Success:      false,
			Detail:       fmt.Sprintf("命令执行失败：%s", err.Error()),
			Request: map[string]any{
				"execution_id": execID,
				"command":      command,
			},
		})
		emitter.Emit(eventDone, map[string]interface{}{
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
			assetName, pluginType := s.assetAuditContext(exec.AssetID)
			s.recordAudit(auditSvc.RecordInput{
				Module:       "executor",
				Action:       "execute_command",
				ResourceType: "asset",
				ResourceID:   uintPtr(exec.AssetID),
				ResourceName: firstNonEmpty(exec.AssetName, assetName),
				PluginType:   pluginType,
				Operator:     operatorName(exec.Operator),
				Success:      false,
				Detail:       fmt.Sprintf("命令执行失败：%s", err.Error()),
				Request: map[string]any{
					"execution_id": execID,
					"command":      command,
				},
			})
			emitter.Emit(eventDone, map[string]interface{}{
				"exec_id": execID, "exit_code": -1,
				"status": execModel.ExecutionStatusFailed,
			})
			return
		}
		session, err = client.NewSession()
		if err != nil {
			s.finishWithError(execID, err.Error())
			assetName, pluginType := s.assetAuditContext(exec.AssetID)
			s.recordAudit(auditSvc.RecordInput{
				Module:       "executor",
				Action:       "execute_command",
				ResourceType: "asset",
				ResourceID:   uintPtr(exec.AssetID),
				ResourceName: firstNonEmpty(exec.AssetName, assetName),
				PluginType:   pluginType,
				Operator:     operatorName(exec.Operator),
				Success:      false,
				Detail:       fmt.Sprintf("命令执行失败：%s", err.Error()),
				Request: map[string]any{
					"execution_id": execID,
					"command":      command,
				},
			})
			return
		}
	}
	defer session.Close()

	var buf bytes.Buffer
	sw := &streamWriter{buf: &buf, emitter: emitter, event: eventOutput}
	session.Stdout = sw
	session.Stderr = sw

	// 使用登录 Shell 执行，确保 PATH 等环境变量正确加载
	shellCmd := fmt.Sprintf("bash -lc %q", command)

	exitCode := 0
	status := execModel.ExecutionStatusSuccess
	if runErr := session.Run(shellCmd); runErr != nil {
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

	assetName, pluginType := s.assetAuditContext(exec.AssetID)
	s.recordAudit(auditSvc.RecordInput{
		Module:       "executor",
		Action:       "execute_command",
		ResourceType: "asset",
		ResourceID:   uintPtr(exec.AssetID),
		ResourceName: firstNonEmpty(exec.AssetName, assetName),
		PluginType:   pluginType,
		Operator:     operatorName(exec.Operator),
		Success:      status == execModel.ExecutionStatusSuccess,
		Detail:       fmt.Sprintf("命令执行完成，状态=%s，退出码=%d", status, exitCode),
		Request: map[string]any{
			"execution_id": execID,
			"command":      command,
		},
		Result: map[string]any{
			"execution_id":  execID,
			"status":        status,
			"exit_code":     exitCode,
			"output_length": len(output),
		},
	})

	emitter.Emit(eventDone, map[string]interface{}{
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

func (s *ExecutorService) recordAudit(input auditSvc.RecordInput) {
	if s.audit == nil {
		return
	}
	s.audit.RecordBestEffort(input)
}

func (s *ExecutorService) assetAuditContext(assetID uint) (string, string) {
	asset, err := s.assetRepo.FindByID(assetID)
	if err != nil {
		return "", ""
	}
	return asset.Name, asset.PluginType
}

func operatorName(operator string) string {
	if operator == "" {
		return "admin"
	}
	return operator
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func uintPtr(value uint) *uint {
	return &value
}

// streamWriter 实时流式写入器：同时写入 buffer 并通过 Emitter 推送事件
type streamWriter struct {
	buf     *bytes.Buffer
	emitter event.Emitter
	event   string
}

func (w *streamWriter) Write(p []byte) (n int, err error) {
	n, err = w.buf.Write(p)
	if n > 0 {
		w.emitter.Emit(w.event, string(p[:n]))
	}
	return
}

package service

import (
	"encoding/json"
	"fmt"
	"sync"

	auditModel "EnvPilot/internal/audit/model"
	auditRepo "EnvPilot/internal/audit/repository"
	configModel "EnvPilot/internal/config/model"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
)

type RecordInput struct {
	Module       string
	Action       string
	ResourceType string
	ResourceID   *uint
	ResourceName string
	PluginType   string
	Operator     string
	Success      bool
	Detail       string
	Request      any
	Result       any
}

type ListRequest struct {
	Module     string
	Action     string
	PluginType string
	Success    *bool
	Keyword    string
	Limit      int
	Offset     int
}

type ListResult struct {
	Items []auditModel.AuditLog `json:"items"`
	Total int64                 `json:"total"`
}

type AuditService struct {
	repo *auditRepo.AuditRepo
	log  *zap.Logger

	policyMu      sync.RWMutex
	cleanupPolicy CleanupPolicy
	schedulerMu   sync.Mutex
	schedulerBusy bool
	schedulerStop func()
}

func NewAuditService(repo *auditRepo.AuditRepo) *AuditService {
	return &AuditService{
		repo:          repo,
		log:           logger.Named("audit"),
		cleanupPolicy: DefaultCleanupPolicy(),
	}
}

func (s *AuditService) Record(input RecordInput) error {
	if input.Module == "" || input.Action == "" {
		return fmt.Errorf("审计记录缺少 module/action")
	}

	logEntry := &auditModel.AuditLog{
		Module:       input.Module,
		Action:       input.Action,
		ResourceType: input.ResourceType,
		ResourceID:   input.ResourceID,
		ResourceName: input.ResourceName,
		PluginType:   input.PluginType,
		Operator:     input.Operator,
		Success:      input.Success,
		Detail:       input.Detail,
		RequestData:  marshalAuditValue(input.Request),
		ResultData:   marshalAuditValue(input.Result),
	}

	if err := s.repo.Create(logEntry); err != nil {
		return fmt.Errorf("写入审计日志失败: %w", err)
	}

	s.log.Info("记录审计日志",
		zap.String("module", input.Module),
		zap.String("action", input.Action),
		zap.Bool("success", input.Success),
	)
	return nil
}

func (s *AuditService) RecordBestEffort(input RecordInput) {
	if err := s.Record(input); err != nil {
		s.log.Warn("写入审计日志失败", zap.Error(err), zap.String("module", input.Module), zap.String("action", input.Action))
	}
}

func (s *AuditService) List(req ListRequest) (*ListResult, error) {
	items, total, err := s.repo.List(auditRepo.AuditFilter{
		Module:     req.Module,
		Action:     req.Action,
		PluginType: req.PluginType,
		Success:    req.Success,
		Keyword:    req.Keyword,
		Limit:      req.Limit,
		Offset:     req.Offset,
	})
	if err != nil {
		return nil, err
	}
	return &ListResult{Items: items, Total: total}, nil
}

func (s *AuditService) UpdateConfig(cfg configModel.AuditSection) {
	policy := cleanupPolicyFromConfig(cfg)
	s.policyMu.Lock()
	s.cleanupPolicy = policy
	s.policyMu.Unlock()

	s.StopCleanupScheduler()
	if policy.AutoCleanup {
		s.StartCleanupScheduler()
	} else {
		s.log.Info("审计日志自动清理未启用",
			zap.Int("retention_days", policy.RetentionDays),
			zap.Int("max_records", policy.MaxRecords),
		)
	}
}

func marshalAuditValue(value any) string {
	if value == nil {
		return ""
	}
	b, err := json.Marshal(value)
	if err != nil {
		return fmt.Sprintf(`{"marshal_error":%q}`, err.Error())
	}
	return string(b)
}

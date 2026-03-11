package service

import (
	"context"
	"fmt"
	"time"

	auditRepo "EnvPilot/internal/audit/repository"
	configModel "EnvPilot/internal/config/model"

	"go.uber.org/zap"
)

const defaultAuditCleanupFirstDelay = 30 * time.Second

type CleanupPolicy struct {
	AutoCleanup          bool `json:"auto_cleanup"`
	RetentionDays        int  `json:"retention_days"`
	MaxRecords           int  `json:"max_records"`
	CleanupIntervalHours int  `json:"cleanup_interval_hours"`
}

type CleanupResult struct {
	Trigger              string    `json:"trigger"`
	RetentionDays        int       `json:"retention_days"`
	MaxRecords           int       `json:"max_records"`
	CleanupIntervalHours int       `json:"cleanup_interval_hours"`
	DeletedByAge         int64     `json:"deleted_by_age"`
	DeletedByCount       int64     `json:"deleted_by_count"`
	DeletedTotal         int64     `json:"deleted_total"`
	TotalBefore          int64     `json:"total_before"`
	TotalAfter           int64     `json:"total_after"`
	Recorded             bool      `json:"recorded"`
	CleanedAt            time.Time `json:"cleaned_at"`
}

func DefaultCleanupPolicy() CleanupPolicy {
	return cleanupPolicyFromConfig(configModel.Default().Audit)
}

func cleanupPolicyFromConfig(cfg configModel.AuditSection) CleanupPolicy {
	return CleanupPolicy{
		AutoCleanup:          cfg.AutoCleanup,
		RetentionDays:        cfg.RetentionDays,
		MaxRecords:           cfg.MaxRecords,
		CleanupIntervalHours: cfg.CleanupIntervalHours,
	}
}

func (s *AuditService) GetCleanupPolicy() CleanupPolicy {
	s.policyMu.RLock()
	defer s.policyMu.RUnlock()
	return s.cleanupPolicy
}

func (s *AuditService) CleanupNow() (*CleanupResult, error) {
	return s.cleanup("manual")
}

func (s *AuditService) StartCleanupScheduler() {
	policy := s.GetCleanupPolicy()
	if !policy.AutoCleanup {
		s.log.Info("审计日志自动清理未启用")
		return
	}

	s.schedulerMu.Lock()
	if s.schedulerStop != nil {
		s.schedulerMu.Unlock()
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.schedulerStop = cancel
	s.schedulerBusy = false
	s.schedulerMu.Unlock()

	go s.schedulerLoop(ctx)
	s.log.Info("审计日志自动清理已启动",
		zap.Int("retention_days", policy.RetentionDays),
		zap.Int("max_records", policy.MaxRecords),
		zap.Int("interval_hours", policy.CleanupIntervalHours),
	)
}

func (s *AuditService) StopCleanupScheduler() {
	s.schedulerMu.Lock()
	cancel := s.schedulerStop
	s.schedulerStop = nil
	s.schedulerBusy = false
	s.schedulerMu.Unlock()

	if cancel != nil {
		cancel()
		s.log.Info("审计日志自动清理已停止")
	}
}

func (s *AuditService) schedulerLoop(ctx context.Context) {
	timer := time.NewTimer(defaultAuditCleanupFirstDelay)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			s.runScheduledCleanup()
			policy := s.GetCleanupPolicy()
			timer.Reset(time.Duration(policy.CleanupIntervalHours) * time.Hour)
		}
	}
}

func (s *AuditService) runScheduledCleanup() {
	if !s.beginScheduledRun() {
		s.log.Warn("自动审计清理跳过：上一轮仍在执行或调度器已停止")
		return
	}
	defer s.endScheduledRun()

	startedAt := time.Now()
	result, err := s.cleanup("scheduled")
	if err != nil {
		s.log.Warn("自动审计清理失败", zap.Error(err))
		return
	}

	s.log.Info("自动审计清理完成",
		zap.Int64("deleted", result.DeletedTotal),
		zap.Int64("remaining", result.TotalAfter),
		zap.Duration("duration", time.Since(startedAt)),
	)
}

func (s *AuditService) beginScheduledRun() bool {
	s.schedulerMu.Lock()
	defer s.schedulerMu.Unlock()
	if s.schedulerStop == nil || s.schedulerBusy {
		return false
	}
	s.schedulerBusy = true
	return true
}

func (s *AuditService) endScheduledRun() {
	s.schedulerMu.Lock()
	s.schedulerBusy = false
	s.schedulerMu.Unlock()
}

func (s *AuditService) cleanup(trigger string) (*CleanupResult, error) {
	policy := s.GetCleanupPolicy()
	cleanedAt := time.Now()

	summary, err := s.repo.Cleanup(cleanedAt.AddDate(0, 0, -policy.RetentionDays), policy.MaxRecords)
	if err != nil {
		return nil, fmt.Errorf("清理审计日志失败: %w", err)
	}

	result := cleanupResultFromSummary(summary, policy, trigger, cleanedAt)
	if shouldRecordCleanup(trigger, result) {
		auditResult := *result
		auditResult.Recorded = true
		auditResult.TotalAfter++
		if err := s.Record(cleanupAuditInput(trigger, &auditResult)); err != nil {
			s.log.Warn("记录审计清理结果失败", zap.Error(err), zap.String("trigger", trigger))
		} else {
			*result = auditResult
		}
	}

	return result, nil
}

func cleanupResultFromSummary(summary *auditRepo.CleanupSummary, policy CleanupPolicy, trigger string, cleanedAt time.Time) *CleanupResult {
	return &CleanupResult{
		Trigger:              trigger,
		RetentionDays:        policy.RetentionDays,
		MaxRecords:           policy.MaxRecords,
		CleanupIntervalHours: policy.CleanupIntervalHours,
		DeletedByAge:         summary.DeletedByAge,
		DeletedByCount:       summary.DeletedByCount,
		DeletedTotal:         summary.DeletedByAge + summary.DeletedByCount,
		TotalBefore:          summary.TotalBefore,
		TotalAfter:           summary.TotalAfter,
		CleanedAt:            cleanedAt,
	}
}

func shouldRecordCleanup(trigger string, result *CleanupResult) bool {
	return trigger == "manual" || result.DeletedTotal > 0
}

func cleanupAuditInput(trigger string, result *CleanupResult) RecordInput {
	return RecordInput{
		Module:       "audit",
		Action:       "cleanup_logs",
		ResourceType: "audit_log",
		ResourceName: "audit_logs",
		Operator:     cleanupOperator(trigger),
		Success:      true,
		Detail:       cleanupDetail(result),
		Request: map[string]any{
			"trigger":                trigger,
			"retention_days":         result.RetentionDays,
			"max_records":            result.MaxRecords,
			"cleanup_interval_hours": result.CleanupIntervalHours,
		},
		Result: result,
	}
}

func cleanupOperator(trigger string) string {
	if trigger == "scheduled" {
		return "system"
	}
	return "admin"
}

func cleanupDetail(result *CleanupResult) string {
	if result.DeletedTotal == 0 {
		return fmt.Sprintf("审计日志清理完成：无需删除，当前保留 %d 条", result.TotalAfter)
	}
	return fmt.Sprintf("审计日志清理完成：共删除 %d 条（过期 %d 条，超量裁剪 %d 条），当前保留 %d 条", result.DeletedTotal, result.DeletedByAge, result.DeletedByCount, result.TotalAfter)
}

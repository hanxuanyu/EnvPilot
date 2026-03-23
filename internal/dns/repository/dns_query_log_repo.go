package repository

import (
	"EnvPilot/internal/dns/model"
	"time"

	"gorm.io/gorm"
)

type DNSQuerySummaryFilter struct {
	EnvironmentID uint
	Keyword       string
	Source        string
	Limit         int
	Offset        int
}

type DNSQuerySummaryRepo struct {
	db *gorm.DB
}

func NewDNSQuerySummaryRepo(db *gorm.DB) *DNSQuerySummaryRepo {
	return &DNSQuerySummaryRepo{db: db}
}

// Upsert 对同一 (domain, question_type, source) 组合进行聚合更新。
// 已存在则递增 TotalCount 并更新 Last* 字段，不存在则创建新记录。
func (r *DNSQuerySummaryRepo) Upsert(summary *model.DNSQuerySummary) error {
	now := time.Now().UTC()
	var existing model.DNSQuerySummary
	err := r.db.
		Where("domain = ? AND question_type = ? AND source = ?",
			summary.Domain, summary.QuestionType, summary.Source).
		First(&existing).Error

	if err == gorm.ErrRecordNotFound {
		summary.TotalCount = 1
		summary.LastQueriedAt = now
		return r.db.Create(summary).Error
	}
	if err != nil {
		return err
	}

	return r.db.Model(&existing).Updates(map[string]interface{}{
		"environment_id":      summary.EnvironmentID,
		"total_count":         gorm.Expr("total_count + 1"),
		"last_response_code":  summary.LastResponseCode,
		"last_answer_summary": summary.LastAnswerSummary,
		"last_hit_local":      summary.LastHitLocal,
		"last_upstream_used":  summary.LastUpstreamUsed,
		"last_client_ip":      summary.LastClientIP,
		"last_duration_ms":    summary.LastDurationMs,
		"last_queried_at":     now,
	}).Error
}

func (r *DNSQuerySummaryRepo) List(filter DNSQuerySummaryFilter) ([]model.DNSQuerySummary, int64, error) {
	tx := r.db.Model(&model.DNSQuerySummary{}).Preload("Environment")
	if filter.EnvironmentID > 0 {
		tx = tx.Where("environment_id = ?", filter.EnvironmentID)
	}
	if filter.Keyword != "" {
		like := "%" + filter.Keyword + "%"
		tx = tx.Where("domain LIKE ? OR last_answer_summary LIKE ? OR last_client_ip LIKE ?", like, like, like)
	}
	if filter.Source != "" {
		tx = tx.Where("source = ?", filter.Source)
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	limit := filter.Limit
	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}

	var list []model.DNSQuerySummary
	err := tx.Order("last_queried_at desc").Limit(limit).Offset(filter.Offset).Find(&list).Error
	return list, total, err
}

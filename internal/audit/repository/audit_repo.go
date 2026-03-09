package repository

import (
	auditModel "EnvPilot/internal/audit/model"

	"gorm.io/gorm"
)

type AuditFilter struct {
	Module     string
	Action     string
	PluginType string
	Success    *bool
	Keyword    string
	Limit      int
	Offset     int
}

type AuditRepo struct {
	db *gorm.DB
}

func NewAuditRepo(db *gorm.DB) *AuditRepo {
	return &AuditRepo{db: db}
}

func (r *AuditRepo) Create(log *auditModel.AuditLog) error {
	return r.db.Create(log).Error
}

func (r *AuditRepo) List(filter AuditFilter) ([]auditModel.AuditLog, int64, error) {
	query := r.db.Model(&auditModel.AuditLog{})
	if filter.Module != "" {
		query = query.Where("module = ?", filter.Module)
	}
	if filter.Action != "" {
		query = query.Where("action = ?", filter.Action)
	}
	if filter.PluginType != "" {
		query = query.Where("plugin_type = ?", filter.PluginType)
	}
	if filter.Success != nil {
		query = query.Where("success = ?", *filter.Success)
	}
	if filter.Keyword != "" {
		like := "%" + filter.Keyword + "%"
		query = query.Where("resource_name LIKE ? OR detail LIKE ? OR result_data LIKE ?", like, like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	limit := filter.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	var list []auditModel.AuditLog
	err := query.Order("created_at desc").Limit(limit).Offset(offset).Find(&list).Error
	return list, total, err
}

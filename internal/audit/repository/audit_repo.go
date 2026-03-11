package repository

import (
	auditModel "EnvPilot/internal/audit/model"
	"time"

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

type CleanupSummary struct {
	TotalBefore    int64
	DeletedByAge   int64
	DeletedByCount int64
	TotalAfter     int64
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

func (r *AuditRepo) Cleanup(cutoff time.Time, maxRecords int) (*CleanupSummary, error) {
	summary := &CleanupSummary{}
	err := r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&auditModel.AuditLog{}).Count(&summary.TotalBefore).Error; err != nil {
			return err
		}

		if !cutoff.IsZero() {
			result := tx.Where("created_at < ?", cutoff).Delete(&auditModel.AuditLog{})
			if result.Error != nil {
				return result.Error
			}
			summary.DeletedByAge = result.RowsAffected
		}

		if maxRecords > 0 {
			var remaining int64
			if err := tx.Model(&auditModel.AuditLog{}).Count(&remaining).Error; err != nil {
				return err
			}
			if remaining > int64(maxRecords) {
				keepIDs := tx.Model(&auditModel.AuditLog{}).
					Select("id").
					Order("created_at DESC").
					Order("id DESC").
					Limit(maxRecords)
				result := tx.Where("id NOT IN (?)", keepIDs).Delete(&auditModel.AuditLog{})
				if result.Error != nil {
					return result.Error
				}
				summary.DeletedByCount = result.RowsAffected
			}
		}

		if err := tx.Model(&auditModel.AuditLog{}).Count(&summary.TotalAfter).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return summary, nil
}

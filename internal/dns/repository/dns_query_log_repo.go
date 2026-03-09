package repository

import (
	"EnvPilot/internal/dns/model"

	"gorm.io/gorm"
)

type DNSQueryLogFilter struct {
	EnvironmentID uint
	Keyword       string
	Source        string
	Limit         int
	Offset        int
}

type DNSQueryLogRepo struct {
	db *gorm.DB
}

func NewDNSQueryLogRepo(db *gorm.DB) *DNSQueryLogRepo {
	return &DNSQueryLogRepo{db: db}
}

func (r *DNSQueryLogRepo) Create(log *model.DNSQueryLog) error {
	return r.db.Create(log).Error
}

func (r *DNSQueryLogRepo) List(filter DNSQueryLogFilter) ([]model.DNSQueryLog, int64, error) {
	tx := r.db.Model(&model.DNSQueryLog{}).Preload("Environment")
	if filter.EnvironmentID > 0 {
		tx = tx.Where("environment_id = ?", filter.EnvironmentID)
	}
	if filter.Keyword != "" {
		like := "%" + filter.Keyword + "%"
		tx = tx.Where("domain LIKE ? OR answer_summary LIKE ? OR client_ip LIKE ?", like, like, like)
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

	var list []model.DNSQueryLog
	err := tx.Order("queried_at desc").Limit(limit).Offset(filter.Offset).Find(&list).Error
	return list, total, err
}

package repository

import (
	healthModel "EnvPilot/internal/health/model"
	"EnvPilot/internal/plugin"

	"gorm.io/gorm"
)

type LatestFilter struct {
	EnvironmentID uint
	Category      plugin.AssetCategory
	Status        healthModel.HealthStatus
	Keyword       string
	Limit         int
	Offset        int
}

type HealthRepo struct {
	db *gorm.DB
}

func NewHealthRepo(db *gorm.DB) *HealthRepo {
	return &HealthRepo{db: db}
}

func (r *HealthRepo) Create(snapshot *healthModel.HealthSnapshot) error {
	return r.db.Create(snapshot).Error
}

func (r *HealthRepo) ListLatest(filter LatestFilter) ([]healthModel.HealthSnapshot, int64, error) {
	latestSubquery := r.db.Model(&healthModel.HealthSnapshot{}).
		Select("asset_id, MAX(checked_at) AS max_checked_at").
		Group("asset_id")

	tx := r.db.Model(&healthModel.HealthSnapshot{}).
		Joins("JOIN (?) latest ON latest.asset_id = health_snapshots.asset_id AND latest.max_checked_at = health_snapshots.checked_at", latestSubquery).
		Joins("JOIN assets ON assets.id = health_snapshots.asset_id")

	if filter.EnvironmentID > 0 {
		tx = tx.Where("health_snapshots.environment_id = ?", filter.EnvironmentID)
	}
	if filter.Category != "" {
		tx = tx.Where("assets.category = ?", filter.Category)
	}
	if filter.Status != "" {
		tx = tx.Where("health_snapshots.status = ?", filter.Status)
	}
	if filter.Keyword != "" {
		tx = tx.Where("assets.name LIKE ?", "%"+filter.Keyword+"%")
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	limit := filter.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 200 {
		limit = 200
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	var items []healthModel.HealthSnapshot
	err := tx.
		Preload("Asset").
		Preload("Asset.Environment").
		Order("health_snapshots.checked_at desc").
		Limit(limit).
		Offset(offset).
		Find(&items).Error
	return items, total, err
}

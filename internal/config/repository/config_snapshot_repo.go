package repository

import (
	configModel "EnvPilot/internal/config/model"

	"gorm.io/gorm"
)

type SnapshotFilter struct {
	Limit  int
	Offset int
}

type ConfigSnapshotRepo struct {
	db *gorm.DB
}

func NewConfigSnapshotRepo(db *gorm.DB) *ConfigSnapshotRepo {
	return &ConfigSnapshotRepo{db: db}
}

func (r *ConfigSnapshotRepo) Create(snapshot *configModel.ConfigSnapshot) error {
	return r.db.Create(snapshot).Error
}

func (r *ConfigSnapshotRepo) Count() (int64, error) {
	var total int64
	err := r.db.Model(&configModel.ConfigSnapshot{}).Count(&total).Error
	return total, err
}

func (r *ConfigSnapshotRepo) NextVersion() (int, error) {
	var latest configModel.ConfigSnapshot
	err := r.db.Order("version desc").First(&latest).Error
	if err == nil {
		return latest.Version + 1, nil
	}
	if err == gorm.ErrRecordNotFound {
		return 1, nil
	}
	return 0, err
}

func (r *ConfigSnapshotRepo) GetByID(id uint) (*configModel.ConfigSnapshot, error) {
	var snapshot configModel.ConfigSnapshot
	if err := r.db.First(&snapshot, id).Error; err != nil {
		return nil, err
	}
	return &snapshot, nil
}

func (r *ConfigSnapshotRepo) GetLatest() (*configModel.ConfigSnapshot, error) {
	var snapshot configModel.ConfigSnapshot
	if err := r.db.Order("version desc").First(&snapshot).Error; err != nil {
		return nil, err
	}
	return &snapshot, nil
}

func (r *ConfigSnapshotRepo) List(filter SnapshotFilter) ([]configModel.ConfigSnapshot, int64, error) {
	query := r.db.Model(&configModel.ConfigSnapshot{})

	var total int64
	if err := query.Count(&total).Error; err != nil {
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

	var items []configModel.ConfigSnapshot
	err := query.Order("version desc").Limit(limit).Offset(offset).Find(&items).Error
	return items, total, err
}
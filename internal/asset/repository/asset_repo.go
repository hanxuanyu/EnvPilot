package repository

import (
	"EnvPilot/internal/asset/model"
	"EnvPilot/internal/plugin"

	"gorm.io/gorm"
)

type AssetRepo struct {
	db *gorm.DB
}

func NewAssetRepo(db *gorm.DB) *AssetRepo {
	return &AssetRepo{db: db}
}

// AssetFilter 资产列表查询过滤条件
type AssetFilter struct {
	EnvironmentID uint
	GroupID       uint
	Category      plugin.AssetCategory
	PluginType    string
	Status        model.AssetStatus
	Keyword       string // 模糊匹配 name
}

func (r *AssetRepo) Create(a *model.Asset) error {
	return r.db.Create(a).Error
}

func (r *AssetRepo) Update(a *model.Asset) error {
	return r.db.Save(a).Error
}

func (r *AssetRepo) Delete(id uint) error {
	return r.db.Delete(&model.Asset{}, id).Error
}

func (r *AssetRepo) FindByID(id uint) (*model.Asset, error) {
	var a model.Asset
	err := r.db.
		Preload("Environment").
		Preload("Group").
		Preload("Credential").
		First(&a, id).Error
	return &a, err
}

func (r *AssetRepo) List(f AssetFilter) ([]model.Asset, error) {
	tx := r.db.
		Preload("Environment").
		Preload("Group").
		Preload("Credential")

	if f.EnvironmentID > 0 {
		tx = tx.Where("environment_id = ?", f.EnvironmentID)
	}
	if f.GroupID > 0 {
		tx = tx.Where("group_id = ?", f.GroupID)
	}
	if f.Category != "" {
		tx = tx.Where("category = ?", f.Category)
	}
	if f.PluginType != "" {
		tx = tx.Where("plugin_type = ?", f.PluginType)
	}
	if f.Status != "" {
		tx = tx.Where("status = ?", f.Status)
	}
	if f.Keyword != "" {
		tx = tx.Where("name LIKE ?", "%"+f.Keyword+"%")
	}

	var list []model.Asset
	err := tx.Order("name asc").Find(&list).Error
	return list, err
}

func (r *AssetRepo) UpdateStatus(id uint, status model.AssetStatus) error {
	return r.db.Model(&model.Asset{}).
		Where("id = ?", id).
		Update("status", status).Error
}

func (r *AssetRepo) CountByEnvironment(envID uint) (int64, error) {
	var count int64
	err := r.db.Model(&model.Asset{}).
		Where("environment_id = ?", envID).
		Count(&count).Error
	return count, err
}

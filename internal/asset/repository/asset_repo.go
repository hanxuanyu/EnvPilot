package repository

import (
	"EnvPilot/internal/asset/model"

	"gorm.io/gorm"
)

// AssetRepo 资产数据访问对象
type AssetRepo struct {
	db *gorm.DB
}

func NewAssetRepo(db *gorm.DB) *AssetRepo {
	return &AssetRepo{db: db}
}

// AssetQuery 资产查询条件
type AssetQuery struct {
	EnvironmentID uint
	GroupID       uint
	Type          model.AssetType
	// Keyword 模糊搜索：匹配名称或 Host
	Keyword string
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

// FindByID 按 ID 查询，预加载环境、分组、凭据
func (r *AssetRepo) FindByID(id uint) (*model.Asset, error) {
	var a model.Asset
	err := r.db.
		Preload("Environment").
		Preload("Group").
		Preload("Credential").
		First(&a, id).Error
	return &a, err
}

// List 根据条件查询资产列表
func (r *AssetRepo) List(q AssetQuery) ([]model.Asset, error) {
	tx := r.db.Preload("Environment").Preload("Group").Preload("Credential")

	if q.EnvironmentID > 0 {
		tx = tx.Where("environment_id = ?", q.EnvironmentID)
	}
	if q.GroupID > 0 {
		tx = tx.Where("group_id = ?", q.GroupID)
	}
	if q.Type != "" {
		tx = tx.Where("type = ?", q.Type)
	}
	if q.Keyword != "" {
		like := "%" + q.Keyword + "%"
		tx = tx.Where("name LIKE ? OR host LIKE ?", like, like)
	}

	var list []model.Asset
	err := tx.Order("name asc").Find(&list).Error
	return list, err
}

// UpdateStatus 仅更新资产状态（供健康检查模块调用）
func (r *AssetRepo) UpdateStatus(id uint, status model.AssetStatus) error {
	return r.db.Model(&model.Asset{}).
		Where("id = ?", id).
		Update("status", status).Error
}

// CountByEnvironment 统计某环境下的资产数量
func (r *AssetRepo) CountByEnvironment(envID uint) (int64, error) {
	var count int64
	err := r.db.Model(&model.Asset{}).Where("environment_id = ?", envID).Count(&count).Error
	return count, err
}

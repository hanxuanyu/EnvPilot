package repository

import (
	"EnvPilot/internal/asset/model"

	"gorm.io/gorm"
)

// GroupRepo 分组数据访问对象
type GroupRepo struct {
	db *gorm.DB
}

func NewGroupRepo(db *gorm.DB) *GroupRepo {
	return &GroupRepo{db: db}
}

func (r *GroupRepo) Create(group *model.Group) error {
	return r.db.Create(group).Error
}

func (r *GroupRepo) Update(group *model.Group) error {
	return r.db.Save(group).Error
}

func (r *GroupRepo) Delete(id uint) error {
	return r.db.Delete(&model.Group{}, id).Error
}

func (r *GroupRepo) FindByID(id uint) (*model.Group, error) {
	var g model.Group
	err := r.db.Preload("Environment").First(&g, id).Error
	return &g, err
}

// ListByEnvironment 查询某环境下的所有分组
func (r *GroupRepo) ListByEnvironment(envID uint) ([]model.Group, error) {
	var list []model.Group
	err := r.db.Where("environment_id = ?", envID).Order("name asc").Find(&list).Error
	return list, err
}

// ListAll 查询全部分组
func (r *GroupRepo) ListAll() ([]model.Group, error) {
	var list []model.Group
	err := r.db.Preload("Environment").Order("name asc").Find(&list).Error
	return list, err
}

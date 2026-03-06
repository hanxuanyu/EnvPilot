// Package repository 实现资产模块的数据访问层。
// 每个 repo 只负责数据库 CRUD，不包含业务逻辑。
package repository

import (
	"EnvPilot/internal/asset/model"

	"gorm.io/gorm"
)

// EnvironmentRepo 环境数据访问对象
type EnvironmentRepo struct {
	db *gorm.DB
}

func NewEnvironmentRepo(db *gorm.DB) *EnvironmentRepo {
	return &EnvironmentRepo{db: db}
}

// Create 创建环境
func (r *EnvironmentRepo) Create(env *model.Environment) error {
	return r.db.Create(env).Error
}

// Update 更新环境（只更新非零字段）
func (r *EnvironmentRepo) Update(env *model.Environment) error {
	return r.db.Save(env).Error
}

// Delete 删除环境（硬删除）
func (r *EnvironmentRepo) Delete(id uint) error {
	return r.db.Delete(&model.Environment{}, id).Error
}

// FindByID 按 ID 查询，预加载分组
func (r *EnvironmentRepo) FindByID(id uint) (*model.Environment, error) {
	var env model.Environment
	err := r.db.Preload("Groups").First(&env, id).Error
	return &env, err
}

// ListAll 查询全部环境，按名称排序
func (r *EnvironmentRepo) ListAll() ([]model.Environment, error) {
	var list []model.Environment
	err := r.db.Order("name asc").Find(&list).Error
	return list, err
}

// ExistsByName 检查名称是否已存在（排除自身）
func (r *EnvironmentRepo) ExistsByName(name string, excludeID uint) (bool, error) {
	var count int64
	q := r.db.Model(&model.Environment{}).Where("name = ?", name)
	if excludeID > 0 {
		q = q.Where("id != ?", excludeID)
	}
	err := q.Count(&count).Error
	return count > 0, err
}

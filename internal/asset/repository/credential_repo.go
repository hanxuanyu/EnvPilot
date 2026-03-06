package repository

import (
	"EnvPilot/internal/asset/model"

	"gorm.io/gorm"
)

// CredentialRepo 凭据数据访问对象
// 注意：所有写入 Secret 字段的值必须已完成加密
type CredentialRepo struct {
	db *gorm.DB
}

func NewCredentialRepo(db *gorm.DB) *CredentialRepo {
	return &CredentialRepo{db: db}
}

func (r *CredentialRepo) Create(c *model.Credential) error {
	return r.db.Create(c).Error
}

func (r *CredentialRepo) Update(c *model.Credential) error {
	return r.db.Save(c).Error
}

func (r *CredentialRepo) Delete(id uint) error {
	return r.db.Delete(&model.Credential{}, id).Error
}

func (r *CredentialRepo) FindByID(id uint) (*model.Credential, error) {
	var c model.Credential
	err := r.db.First(&c, id).Error
	return &c, err
}

func (r *CredentialRepo) ListAll() ([]model.Credential, error) {
	var list []model.Credential
	err := r.db.Order("name asc").Find(&list).Error
	return list, err
}

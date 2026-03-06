package migrations

import (
	assetModel "EnvPilot/internal/asset/model"

	"gorm.io/gorm"
)

// MigrateAsset 创建资产管理相关表：
//   - environments（环境）
//   - groups（分组）
//   - credentials（凭据，加密存储）
//   - assets（资产）
func MigrateAsset(db *gorm.DB) error {
	return db.AutoMigrate(
		&assetModel.Environment{},
		&assetModel.Group{},
		&assetModel.Credential{},
		&assetModel.Asset{},
	)
}

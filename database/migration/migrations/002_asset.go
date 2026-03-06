package migrations

import (
	assetModel "EnvPilot/internal/asset/model"

	"gorm.io/gorm"
)

// MigrateAsset 创建资产管理相关表（新版 Schema，不保留旧数据兼容）：
//   - environments（环境）
//   - groups（分组）
//   - credentials（凭据，加密存储）
//   - assets（资产，含 ext_config JSON 扩展字段）
func MigrateAsset(db *gorm.DB) error {
	// 重建 assets 表以使用新 Schema（移除旧的 host/port/type 列）
	if err := db.Exec("DROP TABLE IF EXISTS assets").Error; err != nil {
		return err
	}
	return db.AutoMigrate(
		&assetModel.Environment{},
		&assetModel.Group{},
		&assetModel.Credential{},
		&assetModel.Asset{},
	)
}

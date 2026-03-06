package migration

import (
	"EnvPilot/database/migration/migrations"

	"gorm.io/gorm"
)

// migrateAsset 资产管理模块数据库迁移
func migrateAsset(db *gorm.DB) error {
	return migrations.MigrateAsset(db)
}

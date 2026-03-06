package migration

import (
	"EnvPilot/database/migration/migrations"

	"gorm.io/gorm"
)

// migrateInitSystem 系统基础表迁移（第一个迁移，所有模块依赖）
func migrateInitSystem(db *gorm.DB) error {
	return migrations.MigrateInitSystem(db)
}

package migration

import (
	"EnvPilot/database/migration/migrations"

	"gorm.io/gorm"
)

// migrateExecutor 执行器模块数据库迁移
func migrateExecutor(db *gorm.DB) error {
	return migrations.MigrateExecutor(db)
}

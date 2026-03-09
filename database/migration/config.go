package migration

import (
	"EnvPilot/database/migration/migrations"

	"gorm.io/gorm"
)

func migrateConfig(db *gorm.DB) error {
	return migrations.MigrateConfig(db)
}
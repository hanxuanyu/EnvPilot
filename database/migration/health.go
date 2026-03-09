package migration

import (
	"EnvPilot/database/migration/migrations"

	"gorm.io/gorm"
)

func migrateHealth(db *gorm.DB) error {
	return migrations.MigrateHealth(db)
}

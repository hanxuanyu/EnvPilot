package migration

import (
	"EnvPilot/database/migration/migrations"

	"gorm.io/gorm"
)

func migrateAudit(db *gorm.DB) error {
	return migrations.MigrateAudit(db)
}

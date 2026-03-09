package migration

import (
	"EnvPilot/database/migration/migrations"

	"gorm.io/gorm"
)

func migrateDNS(db *gorm.DB) error {
	return migrations.MigrateDNS(db)
}

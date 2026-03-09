package migration

import (
	"EnvPilot/database/migration/migrations"

	"gorm.io/gorm"
)

func migrateDNSQueryLog(db *gorm.DB) error {
	return migrations.MigrateDNSQueryLog(db)
}

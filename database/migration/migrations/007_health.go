package migrations

import (
	healthModel "EnvPilot/internal/health/model"

	"gorm.io/gorm"
)

func MigrateHealth(db *gorm.DB) error {
	return db.AutoMigrate(&healthModel.HealthSnapshot{})
}

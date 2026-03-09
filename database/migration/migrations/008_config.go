package migrations

import (
	configModel "EnvPilot/internal/config/model"

	"gorm.io/gorm"
)

func MigrateConfig(db *gorm.DB) error {
	return db.AutoMigrate(&configModel.ConfigSnapshot{})
}
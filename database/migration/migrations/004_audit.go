package migrations

import (
	auditModel "EnvPilot/internal/audit/model"

	"gorm.io/gorm"
)

func MigrateAudit(db *gorm.DB) error {
	return db.AutoMigrate(&auditModel.AuditLog{})
}

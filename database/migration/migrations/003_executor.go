package migrations

import (
	executorModel "EnvPilot/internal/executor/model"

	"gorm.io/gorm"
)

// MigrateExecutor 创建命令执行记录表
func MigrateExecutor(db *gorm.DB) error {
	return db.AutoMigrate(&executorModel.Execution{})
}

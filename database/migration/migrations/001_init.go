// Package migrations 存放所有数据库迁移文件。
// 每个文件对应一个迁移版本，以序号前缀保证执行顺序。
package migrations

import "gorm.io/gorm"

// SystemSetting 系统设置键值对存储表。
// 用于存储：应用 salt、版本号、首次启动时间等系统级信息。
type SystemSetting struct {
	// Key 设置项键名，唯一
	Key       string `gorm:"primaryKey;size:100"`
	// Value 设置项值
	Value     string `gorm:"type:text"`
	// UpdatedAt 最后更新时间
	UpdatedAt int64  `gorm:"autoUpdateTime"`
}

// MigrateInitSystem 执行系统基础表的迁移
func MigrateInitSystem(db *gorm.DB) error {
	return db.AutoMigrate(&SystemSetting{})
}

// Package migration 管理数据库结构迁移。
//
// 设计目的：
//   - 统一管理数据库表结构的版本演进
//   - 使用 GORM AutoMigrate 自动创建和更新表结构
//   - 按模块分组注册迁移，方便各模块独立管理自己的表
//   - 通过 schema_migrations 表记录已执行的迁移，确保每条迁移只执行一次
//
// 使用方式：
//
//	migrator := migration.NewMigrator(db)
//	err := migrator.Run()
package migration

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// MigrationFunc 迁移函数类型
type MigrationFunc func(db *gorm.DB) error

// schemaMigration 迁移历史记录表
// 每条成功执行的迁移都会在此留下记录，下次启动时跳过已执行的迁移。
type schemaMigration struct {
	ID         uint      `gorm:"primaryKey;autoIncrement"`
	Name       string    `gorm:"size:255;uniqueIndex;not null"`
	ExecutedAt time.Time `gorm:"not null"`
}

// Migrator 数据库迁移执行器
type Migrator struct {
	db         *gorm.DB
	migrations []migration
}

// migration 单个迁移项
type migration struct {
	// name 迁移名称，用于日志标识
	name string
	// fn 迁移执行函数
	fn MigrationFunc
}

// NewMigrator 创建迁移执行器
func NewMigrator(db *gorm.DB) *Migrator {
	m := &Migrator{db: db}
	// 注册所有迁移，按顺序执行
	m.register()
	return m
}

// register 注册所有模块的迁移函数，按执行顺序排列
func (m *Migrator) register() {
	// 阶段1：基础系统表
	m.add("001_init_system", migrateInitSystem)
	// 阶段2：资产管理表
	m.add("002_asset", migrateAsset)
	// 阶段3：命令执行记录表
	m.add("003_executor", migrateExecutor)
}

// add 添加一个迁移项
func (m *Migrator) add(name string, fn MigrationFunc) {
	m.migrations = append(m.migrations, migration{name: name, fn: fn})
}

// Run 按注册顺序执行所有迁移，已执行过的迁移自动跳过。
//
// 首次运行时会创建 schema_migrations 表用于版本跟踪。
func (m *Migrator) Run() error {
	// 确保迁移历史表存在（幂等操作，安全重复执行）
	if err := m.db.AutoMigrate(&schemaMigration{}); err != nil {
		return fmt.Errorf("初始化迁移历史表失败: %w", err)
	}

	for _, mg := range m.migrations {
		// 检查该迁移是否已执行
		var count int64
		if err := m.db.Model(&schemaMigration{}).
			Where("name = ?", mg.name).
			Count(&count).Error; err != nil {
			return fmt.Errorf("查询迁移历史失败 [%s]: %w", mg.name, err)
		}
		if count > 0 {
			// 已执行过，跳过
			continue
		}

		// 执行迁移
		if err := mg.fn(m.db); err != nil {
			return fmt.Errorf("迁移 [%s] 执行失败: %w", mg.name, err)
		}

		// 记录执行历史，防止下次重复运行
		if err := m.db.Create(&schemaMigration{
			Name:       mg.name,
			ExecutedAt: time.Now(),
		}).Error; err != nil {
			return fmt.Errorf("记录迁移历史失败 [%s]: %w", mg.name, err)
		}
	}
	return nil
}

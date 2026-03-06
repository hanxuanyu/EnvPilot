// Package migration 管理数据库结构迁移。
//
// 设计目的：
//   - 统一管理数据库表结构的版本演进
//   - 使用 GORM AutoMigrate 自动创建和更新表结构
//   - 按模块分组注册迁移，方便各模块独立管理自己的表
//
// 使用方式：
//
//	migrator := migration.NewMigrator(db)
//	err := migrator.Run()
package migration

import (
	"fmt"

	"gorm.io/gorm"
)

// MigrationFunc 迁移函数类型
type MigrationFunc func(db *gorm.DB) error

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

// Run 按注册顺序执行所有迁移
func (m *Migrator) Run() error {
	for _, mg := range m.migrations {
		if err := mg.fn(m.db); err != nil {
			return fmt.Errorf("迁移 [%s] 执行失败: %w", mg.name, err)
		}
	}
	return nil
}

// Package model 定义资产管理模块的所有数据模型。
package model

import "time"

// Environment 运行环境（如：开发/测试/预发/生产）
// 是所有资产的顶层分类，不同环境之间的资产完全隔离。
type Environment struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string    `gorm:"size:100;not null;uniqueIndex" json:"name"`
	Description string    `gorm:"size:500" json:"description"`
	// Color 用于前端标识环境，十六进制颜色值（如 #3b82f6）
	Color       string    `gorm:"size:20;default:'#3b82f6'" json:"color"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// 关联关系（不存入数据库，用于查询时预加载）
	Groups []Group `gorm:"foreignKey:EnvironmentID" json:"groups,omitempty"`
}

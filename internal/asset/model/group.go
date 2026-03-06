package model

import "time"

// Group 资产分组（隶属于某个环境）
// 用于在同一环境下对资产进行逻辑归类，例如：web层、db层、mq层。
type Group struct {
	ID            uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	EnvironmentID uint      `gorm:"not null;index" json:"environment_id"`
	Name          string    `gorm:"size:100;not null" json:"name"`
	Description   string    `gorm:"size:500" json:"description"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	// 关联
	Environment Environment `gorm:"foreignKey:EnvironmentID" json:"environment,omitempty"`
	Assets      []Asset     `gorm:"foreignKey:GroupID" json:"assets,omitempty"`
}

package model

import "time"

type AuditLog struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Module       string    `gorm:"size:64;index" json:"module"`
	Action       string    `gorm:"size:64;index" json:"action"`
	ResourceType string    `gorm:"size:64;index" json:"resource_type"`
	ResourceID   *uint     `gorm:"index" json:"resource_id,omitempty"`
	ResourceName string    `gorm:"size:255" json:"resource_name,omitempty"`
	PluginType   string    `gorm:"size:64;index" json:"plugin_type,omitempty"`
	Operator     string    `gorm:"size:100;index" json:"operator,omitempty"`
	Success      bool      `gorm:"index" json:"success"`
	Detail       string    `gorm:"type:text" json:"detail,omitempty"`
	RequestData  string    `gorm:"type:text" json:"request_data,omitempty"`
	ResultData   string    `gorm:"type:text" json:"result_data,omitempty"`
	CreatedAt    time.Time `gorm:"index" json:"created_at"`
}

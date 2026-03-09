package model

import "time"

type ConfigSnapshot struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Version   int       `gorm:"uniqueIndex;not null" json:"version"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	Comment   string    `gorm:"size:255" json:"comment,omitempty"`
	CreatedBy string    `gorm:"size:100;index" json:"created_by,omitempty"`
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}
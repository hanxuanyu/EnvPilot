package model

import (
	assetModel "EnvPilot/internal/asset/model"
	"time"
)

type DNSQueryLog struct {
	ID            uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	EnvironmentID *uint     `gorm:"index" json:"environment_id,omitempty"`
	Domain        string    `gorm:"size:255;not null;index" json:"domain"`
	QuestionType  string    `gorm:"size:20;not null;index" json:"question_type"`
	ResponseCode  string    `gorm:"size:20;not null;index" json:"response_code"`
	AnswerSummary string    `gorm:"type:text" json:"answer_summary"`
	Source        string    `gorm:"size:30;not null;index" json:"source"`
	HitLocal      bool      `gorm:"not null;default:false;index" json:"hit_local"`
	UpstreamUsed  bool      `gorm:"not null;default:false;index" json:"upstream_used"`
	ClientIP      string    `gorm:"size:128" json:"client_ip"`
	DurationMs    int64     `gorm:"not null;default:0" json:"duration_ms"`
	QueriedAt     time.Time `gorm:"not null;index" json:"queried_at"`

	Environment *assetModel.Environment `gorm:"foreignKey:EnvironmentID" json:"environment,omitempty"`
}

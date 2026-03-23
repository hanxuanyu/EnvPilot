package model

import (
	assetModel "EnvPilot/internal/asset/model"
	"time"
)

// DNSQuerySummary 每个唯一的 (domain, question_type, source) 组合保留一条聚合记录，
// 记录总查询次数和最后一次查询的详细信息，避免全量保存每次解析记录。
type DNSQuerySummary struct {
	ID                uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Domain            string    `gorm:"size:255;not null;uniqueIndex:idx_dns_query_summary_key" json:"domain"`
	QuestionType      string    `gorm:"size:20;not null;uniqueIndex:idx_dns_query_summary_key" json:"question_type"`
	Source            string    `gorm:"size:30;not null;uniqueIndex:idx_dns_query_summary_key" json:"source"`
	EnvironmentID     *uint     `gorm:"index" json:"environment_id,omitempty"`
	TotalCount        int64     `gorm:"not null;default:1" json:"total_count"`
	LastResponseCode  string    `gorm:"size:20;not null" json:"last_response_code"`
	LastAnswerSummary string    `gorm:"type:text" json:"last_answer_summary"`
	LastHitLocal      bool      `gorm:"not null;default:false" json:"last_hit_local"`
	LastUpstreamUsed  bool      `gorm:"not null;default:false" json:"last_upstream_used"`
	LastClientIP      string    `gorm:"size:128" json:"last_client_ip"`
	LastDurationMs    int64     `gorm:"not null;default:0" json:"last_duration_ms"`
	LastQueriedAt     time.Time `gorm:"not null;index" json:"last_queried_at"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`

	Environment *assetModel.Environment `gorm:"foreignKey:EnvironmentID" json:"environment,omitempty"`
}

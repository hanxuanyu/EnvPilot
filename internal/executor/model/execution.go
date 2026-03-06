package model

import "time"

// ExecutionStatus 命令执行状态
type ExecutionStatus string

const (
	ExecutionStatusRunning     ExecutionStatus = "running"     // 执行中
	ExecutionStatusSuccess     ExecutionStatus = "success"     // 执行成功
	ExecutionStatusFailed      ExecutionStatus = "failed"      // 执行失败
	ExecutionStatusInterrupted ExecutionStatus = "interrupted" // 被中断
)

// Execution SSH 命令执行记录
//
// 记录每一次在资产上执行的命令及其完整输出，用于审计和追溯。
type Execution struct {
	ID        uint            `gorm:"primaryKey;autoIncrement" json:"id"`
	AssetID   uint            `gorm:"not null;index"          json:"asset_id"`
	AssetName string          `gorm:"size:200"                json:"asset_name"` // 冗余存储，防止资产被删后丢失上下文
	AssetHost string          `gorm:"size:500"                json:"asset_host"`
	Command   string          `gorm:"type:text;not null"      json:"command"`
	Output    string          `gorm:"type:text"               json:"output"`
	ExitCode  int             `json:"exit_code"`
	Status    ExecutionStatus `gorm:"size:20;default:'running'" json:"status"`
	Operator  string          `gorm:"size:200;default:'admin'"  json:"operator"`
	StartedAt time.Time       `json:"started_at"`
	FinishedAt *time.Time     `json:"finished_at"`
	CreatedAt time.Time       `json:"created_at"`
}

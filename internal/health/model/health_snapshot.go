package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	assetModel "EnvPilot/internal/asset/model"
)

type HealthStatus string

const (
	HealthStatusUnknown     HealthStatus = "unknown"
	HealthStatusHealthy     HealthStatus = "healthy"
	HealthStatusWarning     HealthStatus = "warning"
	HealthStatusCritical    HealthStatus = "critical"
	HealthStatusUnreachable HealthStatus = "unreachable"
)

type Metrics map[string]any

func (m Metrics) Value() (driver.Value, error) {
	if m == nil {
		return "{}", nil
	}
	b, err := json.Marshal(m)
	return string(b), err
}

func (m *Metrics) Scan(value interface{}) error {
	var data []byte
	switch v := value.(type) {
	case string:
		data = []byte(v)
	case []byte:
		data = v
	case nil:
		*m = make(Metrics)
		return nil
	default:
		return fmt.Errorf("Metrics.Scan: 不支持的类型 %T", value)
	}
	if len(data) == 0 || string(data) == "null" {
		*m = make(Metrics)
		return nil
	}
	return json.Unmarshal(data, m)
}

type HealthSnapshot struct {
	ID            uint         `gorm:"primaryKey;autoIncrement" json:"id"`
	AssetID       uint         `gorm:"not null;index" json:"asset_id"`
	EnvironmentID uint         `gorm:"not null;index" json:"environment_id"`
	Status        HealthStatus `gorm:"size:20;not null;index" json:"status"`
	CheckType     string       `gorm:"size:50;not null;index" json:"check_type"`
	LatencyMS     int64        `gorm:"not null;default:0" json:"latency_ms"`
	Detail        string       `gorm:"size:500" json:"detail"`
	Metrics       Metrics      `gorm:"type:text" json:"metrics"`
	CheckedAt     time.Time    `gorm:"not null;index" json:"checked_at"`
	CreatedAt     time.Time    `json:"created_at"`

	Asset assetModel.Asset `gorm:"foreignKey:AssetID" json:"asset,omitempty"`
}

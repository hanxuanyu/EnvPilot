package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"EnvPilot/internal/plugin"
)

// AssetStatus 资产连接状态
type AssetStatus string

const (
	AssetStatusUnknown AssetStatus = "unknown"
	AssetStatusOnline  AssetStatus = "online"
	AssetStatusOffline AssetStatus = "offline"
	AssetStatusWarning AssetStatus = "warning"
)

// Tags 标签列表，存储为 JSON 字符串
type Tags []string

func (t Tags) Value() (driver.Value, error) {
	if len(t) == 0 {
		return "[]", nil
	}
	b, err := json.Marshal(t)
	return string(b), err
}

func (t *Tags) Scan(value interface{}) error {
	var data []byte
	switch v := value.(type) {
	case string:
		data = []byte(v)
	case []byte:
		data = v
	case nil:
		*t = Tags{}
		return nil
	default:
		return fmt.Errorf("Tags.Scan: 不支持的类型 %T", value)
	}
	return json.Unmarshal(data, t)
}

// ExtConfig 类型专属扩展配置，以 JSON 存储在单列中
type ExtConfig map[string]interface{}

func (e ExtConfig) Value() (driver.Value, error) {
	if e == nil {
		return "{}", nil
	}
	b, err := json.Marshal(e)
	return string(b), err
}

func (e *ExtConfig) Scan(value interface{}) error {
	var data []byte
	switch v := value.(type) {
	case string:
		data = []byte(v)
	case []byte:
		data = v
	case nil:
		*e = make(ExtConfig)
		return nil
	default:
		return fmt.Errorf("ExtConfig.Scan: 不支持的类型 %T", value)
	}
	if len(data) == 0 || string(data) == "null" {
		*e = make(ExtConfig)
		return nil
	}
	return json.Unmarshal(data, e)
}

// GetString 安全读取字符串字段
func (e ExtConfig) GetString(key string) string {
	if e == nil {
		return ""
	}
	v, _ := e[key].(string)
	return v
}

// GetInt 安全读取整数字段（支持 float64 转换，JSON 数字默认为 float64）
func (e ExtConfig) GetInt(key string) int {
	if e == nil {
		return 0
	}
	switch v := e[key].(type) {
	case float64:
		return int(v)
	case int:
		return v
	case int64:
		return int(v)
	}
	return 0
}

// GetBool 安全读取布尔字段
func (e ExtConfig) GetBool(key string) bool {
	if e == nil {
		return false
	}
	v, _ := e[key].(bool)
	return v
}

// Asset 资产（服务器或中间件）
// 公共字段作为独立列，类型专属配置通过 ExtConfig（JSON）存储
type Asset struct {
	ID            uint                 `gorm:"primaryKey;autoIncrement" json:"id"`
	EnvironmentID uint                 `gorm:"not null;index" json:"environment_id"`
	GroupID       *uint                `gorm:"index" json:"group_id"`
	Category      plugin.AssetCategory `gorm:"size:20;not null;index" json:"category"`
	PluginType    string               `gorm:"size:50;not null;index" json:"plugin_type"`
	Name          string               `gorm:"size:200;not null" json:"name"`
	Description   string               `gorm:"size:500" json:"description"`
	Tags          Tags                 `gorm:"type:text" json:"tags"`
	CredentialID  *uint                `gorm:"index" json:"credential_id"`
	Status        AssetStatus          `gorm:"size:20;default:'unknown'" json:"status"`
	LastCheckedAt *time.Time           `json:"last_checked_at"`
	ExtConfig     ExtConfig            `gorm:"type:text" json:"ext_config"`
	CreatedAt     time.Time            `json:"created_at"`
	UpdatedAt     time.Time            `json:"updated_at"`

	Environment Environment `gorm:"foreignKey:EnvironmentID" json:"environment,omitempty"`
	Group       *Group      `gorm:"foreignKey:GroupID" json:"group,omitempty"`
	Credential  *Credential `gorm:"foreignKey:CredentialID" json:"credential,omitempty"`
}

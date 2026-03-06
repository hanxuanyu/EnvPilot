package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// AssetType 资产类型
type AssetType string

const (
	AssetTypeServer    AssetType = "server"    // Linux/Windows 服务器
	AssetTypeMySQL     AssetType = "mysql"     // MySQL 数据库
	AssetTypeRedis     AssetType = "redis"     // Redis 缓存
	AssetTypeRocketMQ  AssetType = "rocketmq"  // RocketMQ 消息队列
	AssetTypeRabbitMQ  AssetType = "rabbitmq"  // RabbitMQ 消息队列
)

// AssetStatus 资产连接状态
type AssetStatus string

const (
	AssetStatusUnknown  AssetStatus = "unknown"   // 未检测
	AssetStatusOnline   AssetStatus = "online"    // 在线
	AssetStatusOffline  AssetStatus = "offline"   // 离线
	AssetStatusWarning  AssetStatus = "warning"   // 告警
)

// Tags 标签列表，存储为 JSON 字符串
type Tags []string

// Value 实现 driver.Valuer，存入数据库时序列化为 JSON
func (t Tags) Value() (driver.Value, error) {
	if len(t) == 0 {
		return "[]", nil
	}
	b, err := json.Marshal(t)
	return string(b), err
}

// Scan 实现 sql.Scanner，从数据库读取时反序列化
func (t *Tags) Scan(value interface{}) error {
	bytes, ok := value.(string)
	if !ok {
		return fmt.Errorf("Tags.Scan: 期望 string，实际 %T", value)
	}
	return json.Unmarshal([]byte(bytes), t)
}

// Asset 资产（服务器或中间件）
// 是 EnvPilot 管理的核心对象，所有运维操作都以 Asset 为目标。
type Asset struct {
	ID            uint        `gorm:"primaryKey;autoIncrement" json:"id"`
	EnvironmentID uint        `gorm:"not null;index" json:"environment_id"`
	GroupID       *uint       `gorm:"index" json:"group_id"`
	// Type 决定了该资产可以执行的操作（SSH/SQL/Redis命令等）
	Type          AssetType   `gorm:"size:20;not null;index" json:"type"`
	Name          string      `gorm:"size:200;not null" json:"name"`
	Host          string      `gorm:"size:500;not null" json:"host"`
	Port          int         `gorm:"not null" json:"port"`
	Description   string      `gorm:"size:500" json:"description"`
	Tags          Tags        `gorm:"type:text" json:"tags"`
	CredentialID  *uint       `gorm:"index" json:"credential_id"`
	Status        AssetStatus `gorm:"size:20;default:'unknown'" json:"status"`
	// LastCheckedAt 最后一次健康检查时间
	LastCheckedAt *time.Time  `json:"last_checked_at"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`

	// 关联（查询时预加载）
	Environment Environment `gorm:"foreignKey:EnvironmentID" json:"environment,omitempty"`
	Group       *Group      `gorm:"foreignKey:GroupID" json:"group,omitempty"`
	Credential  *Credential `gorm:"foreignKey:CredentialID" json:"credential,omitempty"`
}

// DefaultPort 返回不同资产类型的默认端口
func DefaultPort(t AssetType) int {
	switch t {
	case AssetTypeServer:
		return 22
	case AssetTypeMySQL:
		return 3306
	case AssetTypeRedis:
		return 6379
	case AssetTypeRocketMQ:
		return 9876
	case AssetTypeRabbitMQ:
		return 5672
	default:
		return 0
	}
}

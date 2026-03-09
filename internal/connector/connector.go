package connector

import (
	"context"

	assetModel "EnvPilot/internal/asset/model"
)

// Credential 表示连接器运行时可用的已解密凭据。
type Credential struct {
	Type     assetModel.CredentialType `json:"type"`
	Username string                    `json:"username"`
	Secret   string                    `json:"-"`
}

// Target 表示连接器解析后的目标资产。
type Target struct {
	AssetID    uint                 `json:"asset_id"`
	AssetName  string               `json:"asset_name"`
	PluginType string               `json:"plugin_type"`
	ExtConfig  assetModel.ExtConfig `json:"ext_config"`
	Credential *Credential          `json:"credential,omitempty"`
}

// Connector 定义所有连接器的最小能力集。
type Connector interface {
	TypeID() string
	Connect(ctx context.Context) error
	Ping(ctx context.Context) error
	Close() error
}

// DatabaseConnector 定义数据库类资产的统一能力。
type DatabaseConnector interface {
	Connector
	Execute(ctx context.Context, database, query string, limit int) (*QueryResult, error)
	ListDatabases(ctx context.Context) ([]string, error)
	ListTables(ctx context.Context, database string) ([]string, error)
}

// CacheConnector 定义缓存类资产的统一能力。
type CacheConnector interface {
	Connector
	Command(ctx context.Context, command string, args ...string) (*CommandResult, error)
}

// MQConnector 定义消息队列类资产的统一能力。
type MQConnector interface {
	Connector
	SendMessage(ctx context.Context, msg Message) (*SendResult, error)
}

type QueryColumn struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type QueryResult struct {
	Columns    []QueryColumn    `json:"columns"`
	Rows       []map[string]any `json:"rows"`
	Affected   int64            `json:"affected"`
	DurationMS int64            `json:"duration_ms"`
}

type CommandResult struct {
	Command string `json:"command"`
	Result  any    `json:"result"`
}

type Message struct {
	Topic      string            `json:"topic,omitempty"`
	Tag        string            `json:"tag,omitempty"`
	Exchange   string            `json:"exchange,omitempty"`
	RoutingKey string            `json:"routing_key,omitempty"`
	Key        string            `json:"key,omitempty"`
	Headers    map[string]string `json:"headers,omitempty"`
	Body       string            `json:"body"`
}

type SendResult struct {
	Success   bool   `json:"success"`
	MessageID string `json:"message_id,omitempty"`
	Detail    string `json:"detail,omitempty"`
}

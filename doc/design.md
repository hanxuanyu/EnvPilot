# EnvPilot 技术设计文档

## 1. 文档信息

| 字段 | 内容 |
|------|------|
| 版本 | v1.1 |
| 日期 | 2026-03-06 |
| 状态 | 实现中 |
| 关联需求 | req.md v0.2 |
| 变更说明 | v1.1 新增双模式部署架构（桌面 Wails + 服务端 HTTP）、EventEmitter 抽象、服务端 API 设计 |

---

## 2. 整体架构

### 2.1 部署模式概览

EnvPilot 支持两种独立的部署模式，共享全部业务逻辑：

| 特性 | 桌面模式（Wails） | 服务端模式（HTTP） |
|------|-----------------|-----------------|
| 入口 | `main.go` + `app.go` | `cmd/server/main.go` |
| 前端通信 | Wails IPC（原生 WebView 桥接） | REST API + SSE + WebSocket |
| 实时事件 | `wailsruntime.EventsEmit` | `EventBus` → SSE / WebSocket |
| 前端构建 | `npm run build`（`dist/`） | `npm run build:server`（`dist-server/`） |
| 二进制产物 | `envpilot`（含 WebView） | `envpilot-server`（含嵌入静态资源） |
| 构建命令 | `make build-desktop` | `make build-server` |

### 2.2 系统分层

#### 桌面模式

```
┌─────────────────────────────────────────────────────────┐
│                     前端（React）                        │
│   页面层    →    Store 层    →    Service 层             │
│ (Pages/UI)    (Zustand)       (services/*.ts)           │
└──────────────────────┬──────────────────────────────────┘
                       │  Wails IPC（原生 WebView 桥接）
┌──────────────────────┴──────────────────────────────────┐
│              后端（Go）—— app.go / Wails 绑定层          │
│  internal/asset/api  +  internal/executor/api           │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│              内部服务层（internal/app/container.go）     │
│  Asset Service  ─  Executor Service  ─  Plugin Registry │
│                              ↓                          │
│                    SQLite（GORM）                        │
└─────────────────────────────────────────────────────────┘
```

#### 服务端模式

```
┌─────────────────────────────────────────────────────────┐
│                     前端（React）                        │
│   pages → store → services/*.ts → apiClient.ts          │
└──────┬──────────────────────────┬───────────────────────┘
       │ REST API（/api/*）        │ WebSocket / SSE
┌──────┴──────────────────────────┴───────────────────────┐
│              HTTP 层（api/ 包）                          │
│  asset_handler  ─  executor_handler  ─  router + CORS   │
│                EventBus（进程内发布订阅）                 │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│              内部服务层（internal/app/container.go）     │
│  Asset Service  ─  Executor Service  ─  Plugin Registry │
│                              ↓                          │
│                    SQLite（GORM）                        │
└─────────────────────────────────────────────────────────┘
```

### 2.3 模块依赖关系

```
internal/app/container  ── 所有服务的统一初始化入口
asset ─── plugin        (资产模块依赖插件注册表)
        └── connector   (插件包含连接器实现)
executor ─── asset      (执行时查询资产+凭据)
executor ─── event      (通过 Emitter 接口推送事件，解耦 Wails/HTTP)
connector ── asset      (连接时查询资产 ExtConfig+凭据)
health ───── asset      (健康检查时查询资产配置)
audit ───── 全模块      (各模块注入 AuditService)
dns ──────── asset      (DNS 解析目标来自资产)
```

### 2.4 事件推送抽象

命令执行输出和终端 I/O 需要实时推送到前端。为解耦具体传输方式，定义 `event.Emitter` 接口：

```go
// pkg/event/emitter.go
type Emitter interface {
    Emit(event string, data interface{})
}
```

| 模式 | 实现 | 内部机制 |
|------|------|---------|
| 桌面 | `WailsEmitter`（`internal/executor/api/`） | `wailsruntime.EventsEmit` → Wails IPC |
| 服务端 | `BusEmitter`（`api/event_bus.go`） | `EventBus.Publish` → SSE / WebSocket |

服务层 `executor_service.go` 只依赖 `event.Emitter` 接口，两种模式下逻辑完全相同。

---

## 3. 数据库设计

### 3.1 完整 Schema（目标状态）

#### environments 表

```sql
CREATE TABLE environments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    code        TEXT,                           -- 短码，如 dev/test/prod
    description TEXT,
    color       TEXT    NOT NULL DEFAULT '#3b82f6',
    enabled     INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL,
    updated_at  DATETIME NOT NULL
);
```

#### groups 表

```sql
CREATE TABLE groups (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id INTEGER NOT NULL REFERENCES environments(id),
    name           TEXT    NOT NULL,
    description    TEXT,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     DATETIME NOT NULL,
    updated_at     DATETIME NOT NULL
);
```

#### credentials 表

```sql
CREATE TABLE credentials (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    type       TEXT NOT NULL,   -- password | ssh_key | token
    username   TEXT,
    secret     TEXT NOT NULL,   -- AES-256-GCM 加密的 base64
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
```

#### assets 表（重构版）

```sql
CREATE TABLE assets (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id INTEGER  NOT NULL REFERENCES environments(id),
    group_id       INTEGER  REFERENCES groups(id),
    category       TEXT     NOT NULL,   -- server | database | cache | mq | other
    plugin_type    TEXT     NOT NULL,   -- linux_server | mysql | redis | rocketmq | ...
    name           TEXT     NOT NULL,
    description    TEXT,
    tags           TEXT     NOT NULL DEFAULT '[]',  -- JSON 数组
    credential_id  INTEGER  REFERENCES credentials(id),
    status         TEXT     NOT NULL DEFAULT 'unknown',
    last_checked_at DATETIME,
    ext_config     TEXT     NOT NULL DEFAULT '{}',  -- JSON，类型专属配置
    created_at     DATETIME NOT NULL,
    updated_at     DATETIME NOT NULL
);

-- 常用查询索引
CREATE INDEX idx_assets_env    ON assets(environment_id);
CREATE INDEX idx_assets_group  ON assets(group_id);
CREATE INDEX idx_assets_cat    ON assets(category);
CREATE INDEX idx_assets_plugin ON assets(plugin_type);
CREATE INDEX idx_assets_status ON assets(status);
```

> **设计说明**：`host`、`port` 等连接参数不再作为独立列，全部存入 `ext_config` JSON 字段。这样的好处是模式统一、便于扩展，代价是无法直接对这些字段建索引，通过应用层过滤弥补。

#### executions 表

```sql
CREATE TABLE executions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id    INTEGER  NOT NULL REFERENCES assets(id),
    asset_name  TEXT     NOT NULL,   -- 冗余，防资产删除后丢失上下文
    asset_host  TEXT     NOT NULL,   -- 冗余，同上（从 ext_config 快照）
    command     TEXT     NOT NULL,
    output      TEXT,
    exit_code   INTEGER  NOT NULL DEFAULT -1,
    status      TEXT     NOT NULL DEFAULT 'running',
    operator    TEXT     NOT NULL DEFAULT 'admin',
    started_at  DATETIME NOT NULL,
    finished_at DATETIME,
    created_at  DATETIME NOT NULL
);
```

#### audit_logs 表

```sql
CREATE TABLE audit_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    operator      TEXT    NOT NULL DEFAULT 'admin',
    action_type   TEXT    NOT NULL,  -- ssh_cmd | sql | redis | mq | config_change | credential_view
    resource_type TEXT,
    resource_id   INTEGER,
    resource_name TEXT,
    detail        TEXT    NOT NULL DEFAULT '{}',  -- JSON
    result        TEXT    NOT NULL DEFAULT 'success',
    created_at    DATETIME NOT NULL
);

CREATE INDEX idx_audit_operator ON audit_logs(operator);
CREATE INDEX idx_audit_action   ON audit_logs(action_type);
CREATE INDEX idx_audit_created  ON audit_logs(created_at);
```

#### dns_records 表

```sql
CREATE TABLE dns_records (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id INTEGER NOT NULL REFERENCES environments(id),
    asset_id       INTEGER REFERENCES assets(id),
    domain         TEXT    NOT NULL,
    record_type    TEXT    NOT NULL DEFAULT 'A',  -- A | CNAME | SRV
    value          TEXT    NOT NULL,
    ttl            INTEGER NOT NULL DEFAULT 300,
    enabled        INTEGER NOT NULL DEFAULT 1,
    created_at     DATETIME NOT NULL,
    updated_at     DATETIME NOT NULL
);
```

#### health_snapshots 表

```sql
CREATE TABLE health_snapshots (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id     INTEGER NOT NULL REFERENCES assets(id),
    status       TEXT    NOT NULL,  -- healthy | warning | critical | unreachable
    ping_ms      REAL,
    tcp_ok       INTEGER,
    cpu_percent  REAL,
    mem_percent  REAL,
    disk_percent REAL,
    raw_data     TEXT    NOT NULL DEFAULT '{}',  -- JSON，完整原始数据
    checked_at   DATETIME NOT NULL
);

CREATE INDEX idx_health_asset   ON health_snapshots(asset_id);
CREATE INDEX idx_health_checked ON health_snapshots(checked_at);
```

#### config_snapshots 表

```sql
CREATE TABLE config_snapshots (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    version    INTEGER NOT NULL,
    content    TEXT    NOT NULL,  -- YAML 全文
    comment    TEXT,
    created_by TEXT    NOT NULL DEFAULT 'admin',
    created_at DATETIME NOT NULL
);
```

### 3.2 迁移策略

由于 `assets` 表已有数据（使用旧 schema，含 `host`、`port`、`type` 字段），需要平滑迁移：

**迁移步骤（`004_asset_refactor`）**：

```go
// 1. 重命名旧表为备份
ALTER TABLE assets RENAME TO assets_v1;

// 2. 创建新表（新 schema）
CREATE TABLE assets (...);

// 3. 数据迁移（将旧字段映射到新字段）
INSERT INTO assets (id, environment_id, group_id, category, plugin_type, name, ...)
SELECT
    id,
    environment_id,
    group_id,
    CASE type
        WHEN 'server'   THEN 'server'
        WHEN 'mysql'    THEN 'database'
        WHEN 'redis'    THEN 'cache'
        WHEN 'rocketmq' THEN 'mq'
        WHEN 'rabbitmq' THEN 'mq'
        ELSE 'other'
    END AS category,
    CASE type
        WHEN 'server'   THEN 'linux_server'
        WHEN 'mysql'    THEN 'mysql'
        WHEN 'redis'    THEN 'redis'
        WHEN 'rocketmq' THEN 'rocketmq'
        WHEN 'rabbitmq' THEN 'rabbitmq'
        ELSE type
    END AS plugin_type,
    name,
    description,
    tags,
    credential_id,
    status,
    last_checked_at,
    json_object('host', host, 'port', port) AS ext_config,
    created_at,
    updated_at
FROM assets_v1;

// 4. 删除备份表（可选，建议保留一段时间）
```

---

## 4. 后端模块设计

### 4.1 Plugin 模块（新增）

插件注册表是整个系统可扩展性的核心，定义在 `internal/plugin/` 下。

#### 4.1.1 数据结构

```go
// internal/plugin/definition.go

package plugin

// ConfigFieldType 配置字段类型
type ConfigFieldType string

const (
    FieldTypeText     ConfigFieldType = "text"
    FieldTypeNumber   ConfigFieldType = "number"
    FieldTypePassword ConfigFieldType = "password"
    FieldTypeTextarea ConfigFieldType = "textarea"
    FieldTypeBoolean  ConfigFieldType = "boolean"
    FieldTypeSelect   ConfigFieldType = "select"
    FieldTypeMulti    ConfigFieldType = "multi"    // 多值输入，如多个 broker 地址
)

// SelectOption 下拉选项
type SelectOption struct {
    Value string `json:"value"`
    Label string `json:"label"`
}

// ConfigField 配置字段定义
type ConfigField struct {
    Key         string          `json:"key"`
    Label       string          `json:"label"`
    Type        ConfigFieldType `json:"type"`
    Required    bool            `json:"required"`
    DefaultVal  interface{}     `json:"default_val,omitempty"`
    Options     []SelectOption  `json:"options,omitempty"`
    Placeholder string          `json:"placeholder,omitempty"`
    Description string          `json:"description,omitempty"`
    Secret      bool            `json:"secret,omitempty"`  // 是否敏感字段（前端遮掩）
}

// AssetCategory 资产类别
type AssetCategory string

const (
    CategoryServer   AssetCategory = "server"
    CategoryDatabase AssetCategory = "database"
    CategoryCache    AssetCategory = "cache"
    CategoryMQ       AssetCategory = "mq"
    CategoryOther    AssetCategory = "other"
)

// PluginDef 插件定义
type PluginDef struct {
    TypeID      string        `json:"type_id"`       // 唯一标识，如 "mysql"
    DisplayName string        `json:"display_name"`  // 显示名称，如 "MySQL"
    Category    AssetCategory `json:"category"`      // 所属类别
    IconName    string        `json:"icon_name"`     // 前端图标名称
    ConfigSchema []ConfigField `json:"config_schema"` // 配置字段 Schema
    // 可选：连接器工厂函数（后续 connector 模块实现时注入）
}
```

#### 4.1.2 注册表

```go
// internal/plugin/registry.go

package plugin

import "sync"

var (
    mu       sync.RWMutex
    registry = map[string]*PluginDef{}
)

// Register 注册插件（init 函数中调用）
func Register(def *PluginDef) {
    mu.Lock()
    defer mu.Unlock()
    registry[def.TypeID] = def
}

// Get 获取插件定义
func Get(typeID string) (*PluginDef, bool) {
    mu.RLock()
    defer mu.RUnlock()
    def, ok := registry[typeID]
    return def, ok
}

// List 列出所有插件（可按 category 过滤）
func List(category AssetCategory) []*PluginDef {
    mu.RLock()
    defer mu.RUnlock()
    var result []*PluginDef
    for _, def := range registry {
        if category == "" || def.Category == category {
            result = append(result, def)
        }
    }
    return result
}
```

#### 4.1.3 内置插件定义

```go
// internal/plugin/builtin/linux_server.go
package builtin

import "envpilot/internal/plugin"

func init() {
    plugin.Register(&plugin.PluginDef{
        TypeID:      "linux_server",
        DisplayName: "Linux 服务器",
        Category:    plugin.CategoryServer,
        IconName:    "server",
        ConfigSchema: []plugin.ConfigField{
            {Key: "host",      Label: "主机地址",    Type: plugin.FieldTypeText,   Required: true,  Placeholder: "192.168.1.1 或域名"},
            {Key: "port",      Label: "SSH 端口",    Type: plugin.FieldTypeNumber, Required: true,  DefaultVal: 22},
            {Key: "os_type",   Label: "操作系统",    Type: plugin.FieldTypeSelect, Required: false, DefaultVal: "linux",
                Options: []plugin.SelectOption{{Value: "linux", Label: "Linux"}, {Value: "unix", Label: "Unix"}}},
            {Key: "jump_host", Label: "跳板机地址",  Type: plugin.FieldTypeText,   Required: false, Placeholder: "user@jump.host:22（可选）"},
        },
    })
}

// internal/plugin/builtin/mysql.go
func init() {
    plugin.Register(&plugin.PluginDef{
        TypeID:      "mysql",
        DisplayName: "MySQL",
        Category:    plugin.CategoryDatabase,
        IconName:    "database",
        ConfigSchema: []plugin.ConfigField{
            {Key: "host",         Label: "主机地址",      Type: plugin.FieldTypeText,   Required: true},
            {Key: "port",         Label: "端口",          Type: plugin.FieldTypeNumber, Required: true, DefaultVal: 3306},
            {Key: "database",     Label: "数据库名",      Type: plugin.FieldTypeText,   Required: false},
            {Key: "extra_params", Label: "额外连接参数",  Type: plugin.FieldTypeText,   Required: false, Placeholder: "charset=utf8mb4"},
            {Key: "ssl_mode",     Label: "SSL 模式",      Type: plugin.FieldTypeSelect, Required: false, DefaultVal: "disable",
                Options: []plugin.SelectOption{{Value: "disable", Label: "禁用"}, {Value: "require", Label: "要求"}}},
        },
    })
}

// 其他插件类似定义（redis、postgresql、rocketmq、rabbitmq、kafka）...
```

#### 4.1.4 内置插件引入

在 `main.go` 或 `app.go` 中通过空白导入触发 `init()`：

```go
import (
    _ "envpilot/internal/plugin/builtin"
)
```

### 4.2 Asset 模块（重构）

#### 4.2.1 数据模型

```go
// internal/asset/model/asset.go

package model

import (
    "database/sql/driver"
    "encoding/json"
    "time"
    "envpilot/internal/plugin"
)

type AssetStatus string
const (
    StatusUnknown  AssetStatus = "unknown"
    StatusOnline   AssetStatus = "online"
    StatusOffline  AssetStatus = "offline"
    StatusWarning  AssetStatus = "warning"
)

// Tags JSON 序列化的标签数组
type Tags []string
func (t Tags) Value() (driver.Value, error)  { ... }
func (t *Tags) Scan(src interface{}) error   { ... }

// ExtConfig JSON 序列化的扩展配置
type ExtConfig map[string]interface{}
func (e ExtConfig) Value() (driver.Value, error)  { ... }
func (e *ExtConfig) Scan(src interface{}) error   { ... }

// GetString 安全读取字符串字段
func (e ExtConfig) GetString(key string) string   { ... }
// GetInt 安全读取整数字段
func (e ExtConfig) GetInt(key string) int         { ... }

type Asset struct {
    ID             uint                 `gorm:"primaryKey"`
    EnvironmentID  uint                 `gorm:"not null"`
    GroupID        *uint
    Category       plugin.AssetCategory `gorm:"not null"`
    PluginType     string               `gorm:"not null"`
    Name           string               `gorm:"size:200;not null"`
    Description    string               `gorm:"size:500"`
    Tags           Tags                 `gorm:"type:text;default:'[]'"`
    CredentialID   *uint
    Status         AssetStatus          `gorm:"default:'unknown'"`
    LastCheckedAt  *time.Time
    ExtConfig      ExtConfig            `gorm:"type:text;default:'{}'"`
    CreatedAt      time.Time
    UpdatedAt      time.Time
    // 预加载关联（不存库）
    Environment    Environment  `gorm:"foreignKey:EnvironmentID"`
    Group          *Group       `gorm:"foreignKey:GroupID"`
    Credential     *Credential  `gorm:"foreignKey:CredentialID"`
}
```

#### 4.2.2 Repository 层关键接口

```go
type AssetRepository interface {
    Create(asset *model.Asset) error
    Update(asset *model.Asset) error
    Delete(id uint) error
    FindByID(id uint) (*model.Asset, error)
    List(filter AssetFilter) ([]*model.Asset, error)
    Count(filter AssetFilter) (int64, error)
}

type AssetFilter struct {
    EnvironmentID *uint
    GroupID       *uint
    Category      string   // plugin.AssetCategory
    PluginType    string
    Status        string
    Keyword       string   // 模糊匹配 name
    Tags          []string
}
```

#### 4.2.3 Service 层关键方法

```go
type AssetService struct {
    repo       AssetRepository
    credRepo   CredentialRepository
    pluginReg  *plugin.Registry   // 注入插件注册表
    cipher     *crypto.Cipher
    audit      *audit.AuditService
}

// CreateAsset 创建资产，验证 plugin_type 是否已注册
func (s *AssetService) CreateAsset(req CreateAssetRequest) (*model.Asset, error)

// UpdateAsset 更新资产
func (s *AssetService) UpdateAsset(id uint, req UpdateAssetRequest) (*model.Asset, error)

// GetPluginSchema 获取指定插件的配置 Schema（供前端动态渲染表单）
func (s *AssetService) GetPluginSchema(pluginType string) (*plugin.PluginDef, error)

// ListPlugins 列出所有可用插件（供前端展示类型选择）
func (s *AssetService) ListPlugins(category string) ([]*plugin.PluginDef, error)
```

#### 4.2.4 API 层（Wails 绑定）

```go
// internal/asset/api/asset_api.go

type AssetAPI struct {
    assetSvc *service.AssetService
    envSvc   *service.EnvironmentService
    groupSvc *service.GroupService
    credSvc  *service.CredentialService
}

// 资产 CRUD
func (a *AssetAPI) CreateAsset(req CreateAssetRequest) Result[AssetDTO]
func (a *AssetAPI) UpdateAsset(id uint, req UpdateAssetRequest) Result[AssetDTO]
func (a *AssetAPI) DeleteAsset(id uint) Result[bool]
func (a *AssetAPI) GetAsset(id uint) Result[AssetDTO]
func (a *AssetAPI) ListAssets(filter AssetFilterRequest) Result[[]AssetDTO]

// 插件相关（新增）
func (a *AssetAPI) ListPlugins(category string) Result[[]PluginDefDTO]
func (a *AssetAPI) GetPluginSchema(pluginType string) Result[PluginDefDTO]

// 环境/分组/凭据（保持不变）
// ...
```

### 4.3 Connector 模块（插件化设计）

#### 4.3.1 连接器接口

```go
// internal/connector/connector.go

package connector

import "context"

// Connector 通用连接器接口
type Connector interface {
    Connect(ctx context.Context) error
    Ping(ctx context.Context) error
    Close() error
    TypeID() string
}

// DatabaseConnector 数据库连接器（继承通用接口）
type DatabaseConnector interface {
    Connector
    Execute(ctx context.Context, sql string) (*QueryResult, error)
    ListDatabases(ctx context.Context) ([]string, error)
    ListTables(ctx context.Context, database string) ([]string, error)
}

// CacheConnector 缓存连接器
type CacheConnector interface {
    Connector
    Command(ctx context.Context, cmd string, args ...string) (interface{}, error)
}

// MQConnector 消息队列连接器
type MQConnector interface {
    Connector
    SendMessage(ctx context.Context, msg Message) (*SendResult, error)
}
```

#### 4.3.2 工厂与注册

```go
// internal/connector/factory.go

type ConnectorFactory func(extConfig map[string]interface{}, credential *asset.Credential) (Connector, error)

var factories = map[string]ConnectorFactory{}

func RegisterFactory(typeID string, factory ConnectorFactory) {
    factories[typeID] = factory
}

func NewConnector(typeID string, extConfig map[string]interface{}, cred *asset.Credential) (Connector, error) {
    factory, ok := factories[typeID]
    if !ok {
        return nil, fmt.Errorf("未找到插件类型 %s 的连接器工厂", typeID)
    }
    return factory(extConfig, cred)
}
```

#### 4.3.3 MySQL 连接器实现示例

```go
// internal/connector/impl/mysql/connector.go

type MySQLConnector struct {
    db     *sql.DB
    config MySQLConfig
}

type MySQLConfig struct {
    Host        string
    Port        int
    Database    string
    Username    string
    Password    string
    ExtraParams string
    SSLMode     string
}

func init() {
    connector.RegisterFactory("mysql", func(ext map[string]interface{}, cred *asset.Credential) (connector.Connector, error) {
        cfg := MySQLConfig{
            Host:        extConfig.GetString(ext, "host"),
            Port:        extConfig.GetInt(ext, "port", 3306),
            Database:    extConfig.GetString(ext, "database"),
            ExtraParams: extConfig.GetString(ext, "extra_params"),
        }
        if cred != nil {
            cfg.Username = cred.Username
            cfg.Password = cred.DecryptedSecret // service 层解密后传入
        }
        return &MySQLConnector{config: cfg}, nil
    })
}
```

### 4.4 错误处理规范

```go
// 统一错误包装
return fmt.Errorf("创建资产失败: %w", err)

// 业务错误（可识别类型）
type ErrNotFound struct{ Resource string; ID uint }
type ErrValidation struct{ Field, Message string }
type ErrPluginNotFound struct{ TypeID string }
```

### 4.5 凭据处理规范

```
写入：plaintext → cipher.Encrypt() → base64 → 存 DB
读取展示：DB → maskSecret() → "••••••" 脱敏值
读取使用：DB → cipher.Decrypt() → 明文（仅在 service 内部传递给 connector）
```

凭据**绝不**通过 API 层以明文形式返回给前端（`json:"-"` 标签）。

---

## 5. 前端设计

### 5.1 类型定义

```typescript
// frontend/src/types/asset.ts

export type AssetCategory = 'server' | 'database' | 'cache' | 'mq' | 'other'
export type AssetStatus = 'unknown' | 'online' | 'offline' | 'warning'
export type CredentialType = 'password' | 'ssh_key' | 'token'
export type ConfigFieldType = 'text' | 'number' | 'password' | 'textarea' | 'boolean' | 'select' | 'multi'

export interface SelectOption {
    value: string
    label: string
}

export interface ConfigField {
    key: string
    label: string
    type: ConfigFieldType
    required: boolean
    default_val?: unknown
    options?: SelectOption[]
    placeholder?: string
    description?: string
    secret?: boolean
}

export interface PluginDef {
    type_id: string
    display_name: string
    category: AssetCategory
    icon_name: string
    config_schema: ConfigField[]
}

export interface Asset {
    id: number
    environment_id: number
    group_id?: number
    category: AssetCategory
    plugin_type: string
    name: string
    description?: string
    tags: string[]
    credential_id?: number
    status: AssetStatus
    last_checked_at?: string
    ext_config: Record<string, unknown>   // 类型专属配置
    created_at: string
    updated_at: string
    // 预加载
    environment?: Environment
    group?: Group
    credential?: Credential
}
```

### 5.2 动态表单组件

插件化架构的前端核心是 `DynamicConfigForm` 组件，根据 `ConfigSchema` 自动渲染表单字段。

```typescript
// frontend/src/components/asset/DynamicConfigForm.tsx

interface DynamicConfigFormProps {
    schema: ConfigField[]
    value: Record<string, unknown>
    onChange: (value: Record<string, unknown>) => void
    disabled?: boolean
}

const DynamicConfigForm: React.FC<DynamicConfigFormProps> = ({ schema, value, onChange, disabled }) => {
    return (
        <div className="space-y-4">
            {schema.map(field => (
                <DynamicField
                    key={field.key}
                    field={field}
                    value={value[field.key]}
                    onChange={(val) => onChange({ ...value, [field.key]: val })}
                    disabled={disabled}
                />
            ))}
        </div>
    )
}

// DynamicField 根据 field.type 渲染对应 UI 组件
// text     → <Input>
// number   → <Input type="number">
// password → <Input type="password">
// textarea → <Textarea>
// boolean  → <Switch>
// select   → <Select>
// multi    → <TagInput>（多值输入，逗号分隔或回车分隔）
```

### 5.3 资产管理页面重构

```
AssetPage
├── FilterBar
│   ├── 环境选择器
│   ├── 类别过滤（server/database/cache/mq）
│   ├── 插件类型过滤（动态，来自已注册插件）
│   └── 关键字搜索
│
├── AssetTable
│   ├── 列：名称+标签 / 类型（category+plugin_type）/ 状态 / 所属环境/分组 / 操作
│   └── 操作：编辑 / 删除 / 连接测试 / 快速操作（按类别不同）
│
└── AssetFormModal
    ├── 基础信息（名称、环境、分组、类别）
    ├── 插件类型选择（按类别过滤，展示图标+名称）
    ├── ── 动态分隔线 ──
    ├── DynamicConfigForm（根据 plugin_type 自动渲染）
    ├── 凭据绑定
    ├── 标签
    └── 备注
```

### 5.4 页面-模块对应关系

| 页面 | 主要功能 | 依赖后端模块 |
|------|---------|------------|
| EnvironmentPage | 环境 CRUD | asset.environment |
| AssetPage | 资产+凭据管理（含动态表单） | asset, plugin |
| ExecutorPage | 命令执行+历史 | executor |
| TerminalPage | 在线终端 | executor.terminal |
| ConnectorPage | 中间件查询/发送 | connector |
| DnsPage | DNS 记录管理 | dns |
| HealthPage | 健康状态看板 | health |
| AuditPage | 操作审计 | audit |
| ConfigPage | 系统配置管理 | config |

### 5.5 前端 API 调用规范

```typescript
// 所有 Wails 调用通过 services/ 封装，页面不直接导入 wailsjs
import { listPlugins, listAssets, createAsset } from '@/services/assetService'

// assetService.ts 示例
export const listPlugins = async (category?: string) => {
    const result = await ListPlugins(category ?? '')
    if (!result.success) throw new Error(result.message)
    return result.data
}
```

### 5.6 Store 设计

```typescript
// frontend/src/store/assetStore.ts (扩展)

interface AssetStore {
    // 已有
    assets: Asset[]
    environments: Environment[]
    groups: Group[]
    credentials: Credential[]

    // 新增（插件相关）
    plugins: PluginDef[]
    loadPlugins: () => Promise<void>
    getPluginDef: (typeID: string) => PluginDef | undefined
}
```

---

## 6. API 设计（Wails 绑定接口汇总）

### 6.1 AssetAPI

| 方法 | 描述 |
|------|------|
| `ListEnvironments()` | 列出所有环境 |
| `CreateEnvironment(req)` | 创建环境 |
| `UpdateEnvironment(id, req)` | 更新环境 |
| `DeleteEnvironment(id)` | 删除环境 |
| `ListGroups(envID)` | 列出分组 |
| `CreateGroup(req)` | 创建分组 |
| `UpdateGroup(id, req)` | 更新分组 |
| `DeleteGroup(id)` | 删除分组 |
| `ListAssets(filter)` | 列出资产（支持多维度过滤） |
| `GetAsset(id)` | 获取单个资产 |
| `CreateAsset(req)` | 创建资产 |
| `UpdateAsset(id, req)` | 更新资产 |
| `DeleteAsset(id)` | 删除资产 |
| `ListCredentials()` | 列出凭据 |
| `CreateCredential(req)` | 创建凭据 |
| `UpdateCredential(id, req)` | 更新凭据 |
| `DeleteCredential(id)` | 删除凭据 |
| `RevealCredential(id)` | 明文查看凭据（审计记录） |
| **`ListPlugins(category)`** | **列出已注册插件**（新增） |
| **`GetPluginSchema(typeID)`** | **获取插件 Schema**（新增） |

### 6.2 ConnectorAPI（新增）

| 方法 | 描述 |
|------|------|
| `TestConnection(assetID)` | 连接测试 |
| `ExecuteSQL(assetID, sql)` | 执行 SQL（数据库类） |
| `ListDatabases(assetID)` | 列出数据库 |
| `ListTables(assetID, database)` | 列出表 |
| `ExecuteRedisCmd(assetID, cmd, args)` | 执行 Redis 命令 |
| `SendMQMessage(assetID, msg)` | 发送 MQ 消息 |

### 6.3 ExecutorAPI（已有，保持）

| 方法 | 描述 |
|------|------|
| `ExecuteCommand(assetID, cmd)` | SSH 命令执行 |
| `BatchExecute(assetIDs, cmd)` | 批量执行 |
| `OpenTerminal(assetID)` | 开启终端会话 |
| `CloseTerminal(sessionID)` | 关闭终端会话 |
| `SendTerminalInput(sessionID, input)` | 发送终端输入 |
| `ListExecutions(filter)` | 查询执行历史 |

---

## 7. 安全设计

### 7.1 凭据加密

- 算法：AES-256-GCM（已实现，`pkg/crypto/aes.go`）
- 密钥派生：PBKDF2-SHA256（已实现，`pkg/crypto/key_derive.go`）
- 当前阶段：使用内置固定密码（阶段 8 替换为用户主密码）
- 凭据 `secret` 字段：`json:"-"` 不暴露给前端，前端只能看到 `secret_masked`

### 7.2 ExtConfig 中的敏感字段

如果 ExtConfig 中有密码类字段（如 RocketMQ 的 `access_key`/`secret_key`），处理方式：

- 方案 A：将此类字段统一通过 `Credential` 管理，ExtConfig 只存非敏感信息。
- 方案 B：敏感字段在写入 ExtConfig 时加密，读取时解密（在 service 层处理）。

**推荐方案**：优先方案 A（将认证信息通过 Credential 管理），ExtConfig 只存连接参数。如 Credential 表达能力不足（如 RocketMQ 需要 AccessKey+SecretKey 而非传统用户名密码），可扩展 Credential 结构，或在方案 B 中对 ExtConfig 中标记 `secret: true` 的字段进行加密存储。

### 7.3 操作权限

- 当前阶段为本地单用户桌面工具，主要通过只读模式开关控制。
- 后续阶段（auth 模块）引入 JWT + 本地认证。

---

## 8. 目录结构（目标状态）

```
EnvPilot/
├── main.go
├── app.go
├── wails.json
├── go.mod
│
├── config/
│   └── config.yaml
│
├── database/
│   ├── db.go
│   └── migration/
│       ├── migrator.go
│       └── migrations/
│           ├── 001_init.go
│           ├── 002_asset.go        (旧资产表，已废弃逻辑)
│           ├── 003_executor.go
│           └── 004_asset_refactor.go  ← 新增：资产表结构重构迁移
│
├── internal/
│   ├── plugin/                     ← 新增：插件注册表
│   │   ├── definition.go           (PluginDef / ConfigField 数据结构)
│   │   ├── registry.go             (注册/查询接口)
│   │   └── builtin/                (内置插件定义，通过 init() 注册)
│   │       ├── linux_server.go
│   │       ├── windows_server.go
│   │       ├── mysql.go
│   │       ├── postgresql.go
│   │       ├── redis.go
│   │       ├── rocketmq.go
│   │       ├── rabbitmq.go
│   │       └── kafka.go
│   │
│   ├── asset/                      ← 重构
│   │   ├── model/
│   │   │   ├── environment.go
│   │   │   ├── group.go
│   │   │   ├── asset.go            (新字段：category, plugin_type, ext_config)
│   │   │   └── credential.go
│   │   ├── repository/
│   │   │   ├── asset_repo.go       (支持 AssetFilter 多维过滤)
│   │   │   ├── environment_repo.go
│   │   │   ├── group_repo.go
│   │   │   └── credential_repo.go
│   │   ├── service/
│   │   │   ├── asset_service.go    (注入 plugin.Registry)
│   │   │   ├── environment_service.go
│   │   │   ├── group_service.go
│   │   │   └── credential_service.go
│   │   └── api/
│   │       ├── asset_api.go        (新增 ListPlugins / GetPluginSchema)
│   │       └── result.go
│   │
│   ├── connector/                  ← 重构（插件化）
│   │   ├── connector.go            (接口定义)
│   │   ├── factory.go              (工厂 + 注册表)
│   │   ├── impl/                   (具体实现)
│   │   │   ├── mysql/
│   │   │   ├── postgresql/
│   │   │   ├── redis/
│   │   │   ├── rocketmq/
│   │   │   ├── rabbitmq/
│   │   │   └── kafka/
│   │   ├── service/
│   │   │   └── connector_service.go
│   │   └── api/
│   │       └── connector_api.go
│   │
│   ├── executor/                   ← 已完成，保持不变
│   ├── dns/
│   ├── health/
│   ├── audit/
│   ├── config/
│   └── auth/
│
├── pkg/
│   ├── crypto/
│   └── logger/
│
├── doc/
│   ├── design.md                   ← 本文档
│   └── dev.md                      ← 开发步骤文档
│
├── req.md                          ← 需求文档 v0.2
│
└── frontend/
    └── src/
        ├── types/
        │   └── asset.ts            (新增 PluginDef / ConfigField 类型)
        ├── components/
        │   ├── asset/              ← 新增
        │   │   ├── DynamicConfigForm.tsx  (动态表单核心组件)
        │   │   ├── DynamicField.tsx
        │   │   ├── AssetFormModal.tsx     (重构：集成动态表单)
        │   │   └── PluginSelector.tsx     (插件类型选择组件)
        │   ├── common/
        │   └── ui/
        ├── pages/
        │   ├── AssetPage.tsx       (重构：支持动态表单)
        │   └── ConnectorPage.tsx   (实现：中间件查询/发送)
        ├── services/
        │   ├── assetService.ts     (新增 listPlugins / getPluginSchema)
        │   └── connectorService.ts (新增)
        └── store/
            ├── assetStore.ts       (新增 plugins 状态)
            └── connectorStore.ts   (新增)
```

---

## 9. 关键设计决策与权衡

### 9.1 ExtConfig 使用 JSON vs 独立表

| 方案 | 优点 | 缺点 |
|------|------|------|
| JSON ExtConfig（本方案） | 无需迁移即可扩展字段；单表查询；模式统一 | 无法直接 SQL 查询 JSON 内字段；类型校验在应用层 |
| 独立配置表（每种类型一张表） | 强类型；可建索引 | 每增加类型需 DDL 变更；JOIN 查询复杂 |
| EAV 模型（属性-值表） | 灵活 | 查询极其复杂；性能差 |

**结论**：选用 JSON ExtConfig 方案。资产列表的筛选主要基于 `category`、`plugin_type`、`status` 等公共字段，这些字段已有索引，JSON 内字段只在详情页展示，不需要直接查询。

### 9.2 插件注册 - 编译期 vs 运行期

| 方案 | 优点 | 缺点 |
|------|------|------|
| 编译期（init() 注册，本阶段） | 类型安全；部署简单 | 增加新插件需重新编译 |
| 运行期（加载动态库/脚本） | 无需重编译 | 桌面应用分发复杂；安全风险 |

**结论**：M1/M2 阶段使用编译期注册，M3 阶段评估外部插件加载机制。

### 9.3 凭据与 ExtConfig 的职责划分

- **Credential**：负责认证身份（谁去连接），如用户名+密码、SSH 私钥、API Token。
- **ExtConfig**：负责连接参数（连接到哪里），如 Host、Port、Database、Topic 等。
- 对于 RocketMQ AccessKey/SecretKey：本质是认证凭据，建议扩展 Credential 支持 `access_key` 类型，而不是将其放入 ExtConfig。

---

## 10. 开发规范

> 本章节约束项目开发中需统一遵守的规范，新增代码必须符合以下要求。

### 10.1 后端开发规范（Go）

#### 10.1.1 目录与分层规范

每个业务模块严格遵循四层结构，层间只允许向下依赖：

```
internal/<module>/
├── model/       数据模型（GORM struct）
├── repository/  数据访问层（仅操作数据库）
├── service/     业务逻辑层（跨 repo 协调、加密、审计）
└── api/         Wails 绑定层（参数校验、DTO 转换、Result 包装）
```

- `api` 层**不得**直接访问数据库或 `repository`
- `repository` 层**不得**包含业务逻辑
- 跨模块调用通过 `service` 接口注入，禁止直接 `import` 其他模块的 `repository`

#### 10.1.2 错误处理

```go
// ✅ 统一使用带上下文的错误包装
return fmt.Errorf("创建资产失败: %w", err)

// ✅ 业务错误定义可识别的类型，便于 api 层区分响应码
type ErrNotFound struct {
    Resource string
    ID       uint
}
func (e *ErrNotFound) Error() string {
    return fmt.Sprintf("%s(id=%d) 不存在", e.Resource, e.ID)
}

// ❌ 禁止裸 return err，缺乏上下文
return err
```

#### 10.1.3 Wails API 响应格式

所有 Wails 绑定方法**必须**使用 `Result[T]` 包装，前端通过 `result.success` 判断：

```go
// api/result.go
type Result[T any] struct {
    Success bool   `json:"success"`
    Data    T      `json:"data,omitempty"`
    Message string `json:"message,omitempty"`
}

func OK[T any](data T) Result[T]           { return Result[T]{Success: true, Data: data} }
func Fail[T any](msg string) Result[T]     { return Result[T]{Success: false, Message: msg} }
func ErrResult[T any](err error) Result[T] { return Fail[T](err.Error()) }
```

#### 10.1.4 数据库迁移规范

- 迁移文件统一放置于 `database/migration/migrations/`，文件名格式：`NNN_描述.go`（编号三位，全局递增）
- **禁止修改已执行过的迁移文件**，变更通过新迁移实现
- 每个迁移文件必须包含完整的幂等逻辑（`IF NOT EXISTS`、`IF EXISTS` 等）
- 迁移完成后在 `migrator.go` 中注册：`m.add("004_asset_refactor", migrateAssetRefactor)`

#### 10.1.5 凭据安全规范

```go
// 写入：明文 → 加密 → 存库
encrypted, err := s.cipher.Encrypt(plaintext)

// 展示：库值 → 脱敏
asset.Credential.SecretMasked = maskSecret(raw)  // "abc••••xyz"

// 使用：库值 → 解密（仅在 service 内部，绝不通过 API 层传出）
plaintext, err := s.cipher.Decrypt(encrypted)
```

- `Credential.Secret` 字段必须标注 `json:"-"`，API 层只返回 `SecretMasked`
- 凭据明文查看操作必须写入 `audit_logs`（`action_type = credential_view`）

#### 10.1.6 审计注入规范

需要审计的操作（命令执行、SQL 执行、凭据查看、配置变更等）在 service 构造函数中注入 `AuditService`：

```go
type ExecutorService struct {
    repo     ExecutionRepository
    assetSvc *asset.AssetService
    audit    *audit.AuditService  // 必须注入
}

// 操作完成后记录
s.audit.Record(ctx, audit.ActionSSHCmd, audit.ResourceAsset, assetID, assetName, detail, result)
```

---

### 10.2 前端开发规范（React + TypeScript）

#### 10.2.1 目录结构规范

```
frontend/src/
├── types/          全局 TypeScript 类型定义（与后端 model 对齐）
├── services/       Wails 调用封装（唯一允许 import wailsjs 的层）
├── store/          Zustand 全局状态管理
├── hooks/          自定义 React Hooks
├── components/
│   ├── ui/         shadcn/ui 基础组件（只存放从 shadcn 添加的组件，勿自行修改）
│   ├── common/     项目公共组件（Layout、Sidebar、StatusBadge 等）
│   └── <module>/   业务模块专属组件（asset/、connector/ 等）
├── pages/          路由页面组件（尽量保持轻量，逻辑下沉到 store/service）
└── lib/
    └── utils.ts    cn() 等工具函数
```

#### 10.2.2 Wails 调用规范

```typescript
// ✅ 正确：通过 services/ 封装，统一处理 Result 解包和错误
// frontend/src/services/assetService.ts
import { ListAssets } from '@/wailsjs/go/assetapi/AssetAPI'

export const listAssets = async (filter: AssetFilterRequest): Promise<Asset[]> => {
    const result = await ListAssets(filter)
    if (!result.success) throw new Error(result.message)
    return result.data ?? []
}

// ✅ 正确：页面通过 service 调用
import { listAssets } from '@/services/assetService'

// ❌ 禁止：页面直接调用 wailsjs
import { ListAssets } from '@/wailsjs/go/assetapi/AssetAPI'
```

#### 10.2.3 状态管理规范（Zustand）

```typescript
// ✅ 每个业务模块对应一个 store 文件
// store/assetStore.ts

interface AssetStore {
    // 数据状态（复数名词）
    assets: Asset[]
    environments: Environment[]
    // 加载状态
    loading: boolean
    error: string | null
    // Actions（动词开头）
    loadAssets: (filter?: AssetFilterRequest) => Promise<void>
    createAsset: (req: CreateAssetRequest) => Promise<void>
    updateAsset: (id: number, req: UpdateAssetRequest) => Promise<void>
    deleteAsset: (id: number) => Promise<void>
}

// ✅ 错误统一通过 sonner toast 展示
import { toast } from 'sonner'
loadAssets: async (filter) => {
    set({ loading: true, error: null })
    try {
        const data = await listAssets(filter ?? {})
        set({ assets: data, loading: false })
    } catch (err) {
        const msg = err instanceof Error ? err.message : '加载失败'
        set({ error: msg, loading: false })
        toast.error(msg)
    }
}
```

#### 10.2.4 TypeScript 规范

- 禁止使用 `any`，不确定类型时使用 `unknown` 并进行类型守卫
- API 请求/响应类型必须在 `types/` 目录统一定义，与后端 Go struct 保持字段名和类型一致
- 枚举值使用 `as const` 字符串字面量，与后端保持一致：

```typescript
// ✅
export type AssetCategory = 'server' | 'database' | 'cache' | 'mq' | 'other'

// ❌ 不使用 enum（编译产物冗余）
enum AssetCategory { Server = 'server', ... }
```

---

### 10.3 前端 UI 组件规范

#### 10.3.1 核心原则

1. **优先使用 shadcn/ui 组件**：所有基础 UI 元素必须从 `components/ui/` 引入，禁止重复实现相同功能的自定义组件
2. **不修改 `components/ui/` 下的文件**：shadcn 组件通过 CLI 添加，如需扩展请在 `components/common/` 或 `components/<module>/` 中包装
3. **样式使用 Tailwind CSS**：禁止内联 style，禁止新建 CSS 文件（全局样式除外）
4. **图标统一使用 lucide-react**：禁止引入其他图标库

#### 10.3.2 已有 shadcn/ui 组件（`components/ui/`）

| 组件文件 | 导出组件 | 用途 |
|---------|---------|------|
| `button.tsx` | `Button` | 按钮，支持 variant（default/destructive/outline/ghost/link）和 size（sm/md/lg/icon） |
| `input.tsx` | `Input` | 单行文本输入框 |
| `label.tsx` | `Label` | 表单标签，与 Input 配合使用 |
| `select.tsx` | `Select`、`SelectTrigger`、`SelectContent`、`SelectItem`、`SelectValue` | 下拉选择器（基于 Radix UI） |
| `textarea.tsx` | `Textarea` | 多行文本输入框 |
| `badge.tsx` | `Badge` | 状态/类型徽章，支持 variant（default/secondary/destructive/outline） |
| `dialog.tsx` | `Dialog`、`DialogTrigger`、`DialogContent`、`DialogHeader`、`DialogTitle`、`DialogDescription`、`DialogFooter` | 模态对话框 |

#### 10.3.3 可直接添加的 shadcn/ui 组件（Radix 依赖已安装）

以下组件的 Radix UI 依赖已在 `package.json` 中，可通过 shadcn CLI 直接添加，**需要时在对应阶段任务中添加，不提前安装**：

| 命令 | 组件 | 典型使用场景 |
|------|------|------------|
| `npx shadcn@latest add alert-dialog` | `AlertDialog` | 替代 `ConfirmDialog`，用于删除等破坏性操作的二次确认 |
| `npx shadcn@latest add dropdown-menu` | `DropdownMenu` | 操作列的更多操作菜单（编辑/删除/连接测试） |
| `npx shadcn@latest add scroll-area` | `ScrollArea` | 固定高度可滚动区域（日志输出、SQL 结果、审计列表） |
| `npx shadcn@latest add separator` | `Separator` | 表单内分隔线（基础信息与扩展配置之间） |
| `npx shadcn@latest add tooltip` | `Tooltip` | 图标按钮的悬停说明（状态图标、操作图标） |
| `npx shadcn@latest add tabs` | `Tabs`、`TabsList`、`TabsTrigger`、`TabsContent` | 页面内容切换（资产/凭据、查询/历史） |
| `npx shadcn@latest add table` | `Table`、`TableHeader`、`TableBody`、`TableRow`、`TableHead`、`TableCell` | 替代原生 `<table>`，用于资产列表、执行记录、审计日志 |
| `npx shadcn@latest add card` | `Card`、`CardHeader`、`CardTitle`、`CardContent`、`CardFooter` | 环境卡片、健康状态卡片、插件选择卡片 |
| `npx shadcn@latest add switch` | `Switch` | 布尔型配置开关（TLS 开关、只读模式开关） |
| `npx shadcn@latest add form` | `Form`、`FormField`、`FormItem`、`FormLabel`、`FormControl`、`FormMessage` | 带校验的表单（依赖 react-hook-form + zod） |

> 添加 `form` 组件前需先安装依赖：`npm install react-hook-form zod @hookform/resolvers`

#### 10.3.4 各场景组件选用规范

**对话框与确认**

```typescript
// ✅ 普通表单弹窗：使用 Dialog
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

// ✅ 删除/危险操作确认：使用 AlertDialog（需先添加）
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent } from '@/components/ui/alert-dialog'

// ❌ 禁止使用浏览器原生 confirm()
```

**列表与表格**

```typescript
// ✅ 数据列表统一使用 Table 组件（需先添加）
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

// ✅ 操作列使用 DropdownMenu 收纳多个操作（需先添加）
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
```

**状态展示**

```typescript
// ✅ 状态/类型标签使用 Badge
import { Badge } from '@/components/ui/badge'

// ✅ 图标按钮加 Tooltip 说明（需先添加）
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
```

**表单构建**

```typescript
// ✅ 表单字段统一结构：Label + Input/Select/Textarea + 错误提示
<div className="space-y-2">
    <Label htmlFor="name">资产名称 <span className="text-destructive">*</span></Label>
    <Input id="name" value={value} onChange={...} placeholder="请输入资产名称" />
    {error && <p className="text-sm text-destructive">{error}</p>}
</div>

// ✅ 多字段表单使用 grid 布局
<div className="grid grid-cols-2 gap-4">
    <div className="space-y-2">...</div>  {/* Host */}
    <div className="space-y-2">...</div>  {/* Port */}
</div>

// ✅ 布尔型字段使用 Switch（需先添加）
<div className="flex items-center justify-between">
    <Label>启用 TLS</Label>
    <Switch checked={value} onCheckedChange={onChange} />
</div>
```

**通知提示**

```typescript
// ✅ 操作结果反馈统一使用 sonner toast
import { toast } from 'sonner'

toast.success('资产创建成功')
toast.error('连接失败：' + error.message)
toast.loading('正在连接...')

// ❌ 禁止使用 alert()、confirm()
```

#### 10.3.5 DynamicConfigForm 组件字段映射

动态表单组件 `DynamicConfigForm` 中各 `ConfigFieldType` 对应的 UI 组件：

| ConfigFieldType | 使用组件 | 说明 |
|----------------|---------|------|
| `text` | `Input` | 普通文本输入 |
| `number` | `Input type="number"` | 数字输入（含端口） |
| `password` | `Input type="password"` | 密码/密钥输入，带 show/hide 切换 |
| `textarea` | `Textarea` | 多行输入（SSH 私钥、SQL、消息体） |
| `boolean` | `Switch` | 布尔开关（TLS、SSL 等） |
| `select` | `Select` + `SelectItem` | 枚举选择（SSL 模式、OS 类型） |
| `multi` | 自定义 `TagInput`（基于 `Input` + `Badge`） | 多值输入（Kafka Brokers 列表） |

#### 10.3.6 Tailwind CSS 使用规范

- 使用项目 CSS 变量色值（`bg-background`、`text-foreground`、`border-border` 等），禁止硬编码颜色值（如 `bg-gray-900`）
- 间距遵循 4px 栅格：`space-y-2`（8px）、`space-y-4`（16px）、`gap-4`（16px）
- 统一使用 `cn()` 工具函数合并类名：

```typescript
import { cn } from '@/lib/utils'

<div className={cn('base-class', condition && 'conditional-class', className)} />
```

- 响应式断点：桌面模式为固定窗口（1440×900），服务端模式需兼容浏览器窗口缩放。组件内部布局应使用 `flex`/`grid` 而非固定 `px` 宽度，避免在服务端模式下出现布局溢出

---

### 10.4 代码提交规范

#### Commit Message 格式

```
<type>(<scope>): <subject>

type:
  feat     新功能
  fix      Bug 修复
  refactor 重构（非 bug 修复、非新功能）
  style    格式调整（不影响代码逻辑）
  docs     文档更新
  test     测试相关
  chore    构建/依赖/工具等杂项

scope: 影响的模块，如 asset、executor、plugin、frontend

示例：
  feat(plugin): add kafka plugin definition
  refactor(asset): migrate to ext_config model
  docs(design): add development standards chapter
```

#### 分支规范

```
main          稳定分支，只接受 PR 合并
feat/<name>   功能开发分支
fix/<name>    Bug 修复分支
refactor/<name> 重构分支
```

---

### 10.5 Wails 绑定更新流程

修改后端 API 结构体（新增/删除/改名方法或参数）后，**必须**重新生成前端绑定：

```bash
# 重新生成 wailsjs/ 下的 TypeScript 绑定文件
wails generate module

# 或直接启动开发模式（会自动重新生成）
wails dev
```

生成后必须将以下文件纳入 git 提交：
- `frontend/wailsjs/go/<module>/*.js`
- `frontend/wailsjs/go/<module>/*.d.ts`
- `frontend/wailsjs/go/models.ts`

**禁止**手动修改 `wailsjs/` 下任何自动生成的文件。

### 10.6 服务端模式开发流程

新增 HTTP 接口时需同步更新：

1. **Go handler**（`api/asset_handler.go` 或 `api/executor_handler.go`）
2. **路由注册**（`api/router.go`）
3. **前端 service 函数**，在 `IS_SERVER_MODE` 分支中添加 HTTP 调用

```typescript
// frontend/src/services/xxxService.ts
export async function newOperation(param: Param): Promise<Result> {
  if (IS_SERVER_MODE) {
    return apiClient.http.post('/api/xxx/operation', param)
  }
  return XxxAPIJs.NewOperation(param).then(unwrap)
}
```

---

## 11. 服务端模式 API 设计

### 11.1 统一响应格式

所有 REST 接口均返回与 Wails 模式相同的 `Result[T]` 结构：

```json
{
  "success": true,
  "data": { ... },
  "message": ""
}
```

失败时：
```json
{
  "success": false,
  "message": "错误描述"
}
```

### 11.2 资产管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/plugins` | 获取所有插件定义 |
| GET | `/api/plugins/{type}/schema` | 获取指定插件 Schema |
| GET | `/api/environments` | 获取环境列表 |
| POST | `/api/environments` | 创建环境 |
| PUT | `/api/environments/{id}` | 更新环境 |
| DELETE | `/api/environments/{id}` | 删除环境 |
| GET | `/api/groups` | 获取分组列表（`?env_id=` 过滤） |
| POST | `/api/groups` | 创建分组 |
| PUT | `/api/groups/{id}` | 更新分组 |
| DELETE | `/api/groups/{id}` | 删除分组 |
| GET | `/api/assets` | 资产列表（支持 `category`/`plugin_type`/`env_id` 查询参数） |
| POST | `/api/assets` | 创建资产 |
| PUT | `/api/assets/{id}` | 更新资产 |
| DELETE | `/api/assets/{id}` | 删除资产 |
| GET | `/api/credentials` | 凭据列表 |
| POST | `/api/credentials` | 创建凭据 |
| PUT | `/api/credentials/{id}` | 更新凭据 |
| DELETE | `/api/credentials/{id}` | 删除凭据 |
| POST | `/api/credentials/{id}/reveal` | 获取凭据明文（审计记录） |

### 11.3 命令执行接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/executions` | 提交单资产命令执行 |
| POST | `/api/executions/batch` | 提交批量执行 |
| GET | `/api/executions/{id}` | 获取执行记录详情 |
| GET | `/api/executions` | 分页查询执行历史（`?asset_id=&page=&page_size=`） |
| POST | `/api/executions/check-dangerous` | 检查危险命令 |
| GET | `/api/executions/{id}/stream` | **SSE**：实时订阅命令输出流 |

**SSE 输出流格式**：

```
event: output
data: {"line": "Hello, World!\n", "stream": "stdout"}

event: done
data: {"exit_code": 0, "duration_ms": 1234}
```

### 11.4 在线终端接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ws/terminal` | **WebSocket**：在线 PTY 终端（查询参数 `asset_id`） |

**WebSocket 消息格式**：

上行（浏览器 → 服务器）：
```json
{"type": "input", "data": "ls -la\n"}
{"type": "resize", "cols": 220, "rows": 50}
{"type": "close"}
```

下行（服务器 → 浏览器）：
```json
{"type": "output", "data": "total 48\n..."}
{"type": "error", "message": "连接失败"}
{"type": "closed"}
```

### 11.5 SPA 路由回退

所有非 `/api/` 和 `/ws/` 前缀的请求均返回内嵌的 `index.html`，支持前端 React Router 的客户端路由：

```go
// api/router.go
mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
    // 非 API 路径 → 返回 index.html
    http.ServeFileFS(w, r, assets, "index.html")
})
```

### 11.6 CORS 策略

服务端模式默认允许所有来源（便于开发和内网部署）：

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

> **生产部署建议**：通过 `--cors-origin` 启动参数或配置文件限制允许的来源域名。

---

## 12. 构建与部署

### 12.1 桌面模式构建

```bash
make build-desktop
# 产物：build/bin/envpilot（当前平台）
```

内部流程：
1. Wails 自动构建前端（`dist/`，`mode=desktop`）
2. 将前端资产嵌入 Go 二进制
3. 链接 WebView2 运行时

### 12.2 服务端模式构建

```bash
make build-server
# 产物：bin/envpilot-server（当前平台）

make build-server-linux  # 交叉编译 Linux amd64
# 产物：bin/envpilot-server-linux-amd64
```

内部流程：
1. `npm run build:server --prefix frontend`（输出 `frontend/dist-server/`）
2. `cp -r frontend/dist-server/* cmd/server/dist/`
3. `go build -o bin/envpilot-server ./cmd/server/`（`//go:embed all:dist` 内嵌静态资源）

### 12.3 Vite 双模式构建配置

| 构建参数 | 桌面模式 | 服务端模式 |
|---------|---------|----------|
| `mode` | `desktop`（默认） | `server` |
| `outDir` | `dist/` | `dist-server/` |
| `__APP_MODE__` | `'desktop'` | `'server'` |
| `__API_BASE__` | `''` | `''`（代理模式）或实际地址 |

前端代码通过编译期常量判断模式：

```typescript
// frontend/src/lib/apiClient.ts
export const IS_SERVER_MODE = (typeof __APP_MODE__ !== 'undefined')
    && __APP_MODE__ === 'server'
```

### 12.4 服务端运行

```bash
# 本地运行（默认 :8080）
./bin/envpilot-server

# 指定地址
./bin/envpilot-server --addr :9090

# 数据存储位置默认为 ~/.envpilot/（与桌面模式相同）
```

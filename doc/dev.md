# EnvPilot 开发进度文档

> 本文档记录所有开发阶段的目标、任务拆解和完成状态。
> 每个阶段开始前更新计划，完成后更新状态。
> 详细的系统设计请参考 `doc/design.md`，需求规格请参考 `req.md`。

---

## 技术栈速查

| 层次 | 技术 | 版本 |
|------|------|------|
| 桌面容器 | Wails | v2.11.0 |
| 后端语言 | Go | 1.24 |
| 前端框架 | React + TypeScript | 18 / 5 |
| 样式系统 | TailwindCSS | v4 |
| 状态管理 | Zustand | latest |
| 路由 | React Router DOM | v7 |
| 本地数据库 | SQLite (GORM) | - |
| 日志 | zap + lumberjack | - |
| SSH | golang.org/x/crypto/ssh | - |
| 加密 | AES-256-GCM + PBKDF2 | - |

---

## 模块目录速查

```
internal/
├── plugin/      插件注册表（新增）
├── asset/       资产管理（环境/分组/资产/凭据）
├── executor/    SSH 命令执行
├── terminal/    在线 Terminal（WebSocket + PTY）
├── connector/   中间件连接器（插件化）
├── dns/         内置 DNS 服务
├── health/      健康检查
├── audit/       操作审计
├── config/      系统配置
└── auth/        本地认证

pkg/
├── crypto/      AES-256 加解密 + PBKDF2 密钥派生
└── logger/      全局日志（zap）

database/
├── db.go                   SQLite 连接初始化
└── migration/              数据库迁移管理
```

---

## 开发规范

### 错误处理

```go
// service 方法统一使用带上下文的错误包装
return fmt.Errorf("创建资产失败: %w", err)

// 可识别的业务错误类型
type ErrNotFound struct{ Resource string; ID uint }
type ErrValidation struct{ Field, Message string }
type ErrPluginNotFound struct{ TypeID string }
```

### 凭据处理

```
写入：plaintext → cipher.Encrypt() → base64 → 存 DB
展示：DB value  → maskSecret()     → "••••••" 脱敏值（通过 service 层填充 SecretMasked）
使用：DB value  → cipher.Decrypt() → 明文（仅在 service 内部传递，绝不通过 API 层返回）
```

- Credential.Secret 字段声明 `json:"-"`，前端只接收 `SecretMasked`。

### 审计注入

各 service 构造函数接受 `*audit.AuditService`，在关键操作后调用：

```go
s.audit.Record(ctx, audit.ActionSSHCmd, audit.ResourceAsset, asset.ID, asset.Name, detail, result)
```

### 前端 API 调用

```typescript
// ✅ 正确：通过 services/ 封装
import { listAssets, listPlugins } from '@/services/assetService'

// ❌ 错误：直接调用 wailsjs（不可维护）
import { ListAssets } from '@/wailsjs/go/assetapi/AssetAPI'
```

### 数据库迁移

每个阶段在 `database/migration/migrations/` 下新增迁移文件，并在 `migrator.go` 中注册：

```go
m.add("004_asset_refactor", migrateAssetRefactor)
```

迁移文件编号全局递增，不允许修改已执行的迁移。

### Wails API 绑定

所有 Wails 绑定方法使用 `Result[T]` 泛型包装响应：

```go
type Result[T any] struct {
    Success bool   `json:"success"`
    Data    T      `json:"data,omitempty"`
    Message string `json:"message,omitempty"`
}
```

---

## 阶段总览

| 阶段 | 名称 | 状态 | 说明 |
|------|------|------|------|
| 阶段 1 | 项目初始化 | ✅ 完成 | 工程骨架、基础设施 |
| 阶段 2 | 资产管理系统（初版） | ✅ 完成 | 旧数据模型，已被阶段 2R 替代 |
| 阶段 3 | 服务器执行系统 | ✅ 完成 | SSH 命令执行 + 在线终端 |
| **阶段 2R** | **资产管理重构** | ⬜ 待开始 | 插件化架构 + 新数据模型 |
| 阶段 4 | 中间件连接器 | ⬜ 待开始 | 依赖阶段 2R 完成 |
| 阶段 5 | DNS 服务 | ⬜ 待开始 | 依赖阶段 2R 完成 |
| 阶段 6 | 健康检查 | ⬜ 待开始 | 依赖阶段 2R 完成 |
| 阶段 7 | 审计系统 | ⬜ 待开始 | 依赖阶段 2R 完成 |
| 阶段 8 | 配置系统 | ⬜ 待开始 | 独立模块 |

> **开发优先级**：阶段 2R 是所有后续阶段的基础，必须首先完成。

---

## 阶段 1：项目初始化 ✅

**目标**：建立可运行的工程骨架

### 完成内容

- [x] Task 1.1 — 初始化 Wails 项目（react-ts 模板，窗口 1440×900）
- [x] Task 1.2 — 建立 Go 后端目录结构（9 个模块骨架 + pkg + database）
- [x] Task 1.3 — 实现 logger 模块（zap + lumberjack，文件+控制台双输出）
- [x] Task 1.4 — 实现 crypto 模块（AES-256-GCM + PBKDF2，含单元测试）
- [x] Task 1.5 — 实现配置加载模块（YAML + 校验 + 默认值）
- [x] Task 1.6 — 初始化 SQLite 数据库（GORM + WAL 模式 + 迁移系统）
- [x] Task 1.7 — 初始化 React 前端（TailwindCSS v4 + 路由骨架 + 深色主题）
- [x] Task 1.8 — Wails 绑定验证（Ping/GetVersion，Dashboard 显示连接状态）
- [x] Task 1.9 — 补全 README 和模块说明

### 关键文件

| 文件 | 说明 |
|------|------|
| `app.go` | Wails 组合根，所有模块在此初始化 |
| `main.go` | 程序入口，窗口配置 |
| `config/config.yaml` | 系统配置文件 |
| `pkg/crypto/aes.go` | AES-256-GCM 加解密 |
| `pkg/crypto/key_derive.go` | PBKDF2 密钥派生 |
| `pkg/logger/logger.go` | 全局日志 |
| `database/db.go` | SQLite 连接初始化 |
| `database/migration/migrator.go` | 迁移执行器 |
| `frontend/src/App.tsx` | 前端路由配置 |

---

## 阶段 2：资产管理系统（初版） ✅

> ⚠️ **本阶段已被阶段 2R 替代**。旧数据模型中 `host`、`port`、`type`（取值如 `server`/`mysql`/`redis`）将在阶段 2R 中迁移到新模型。

### 旧数据模型（已废弃）

```
Asset: id, env_id, group_id, type(server|mysql|redis|rocketmq|rabbitmq), name, host, port, tags, credential_id, status
```

### 完成内容

- [x] Task 2.1 — 数据模型定义（4 个 model：Environment/Group/Asset/Credential）
- [x] Task 2.2 — 数据库迁移（002_asset）
- [x] Task 2.3 — Repository 层（4 个 repo，CRUD + 搜索）
- [x] Task 2.4 — Service 层（业务逻辑，含凭据加密/脱敏）
- [x] Task 2.5 — API 层（Wails 绑定接口）
- [x] Task 2.6 — 前端 Store（Zustand 状态管理）
- [x] Task 2.7 — 环境管理页面（EnvironmentPage）
- [x] Task 2.8 — 资产列表页面（AssetPage）
- [x] Task 2.9 — 凭据管理（嵌入资产管理，脱敏显示）

---

## 阶段 3：服务器执行系统 ✅

**目标**：SSH 命令执行 + 在线 Terminal

### 完成内容

- [x] Task 3.1 — SSH 连接管理（连接池，复用连接）
- [x] Task 3.2 — 单条命令执行（实时输出流 via Wails EventsEmit）
- [x] Task 3.3 — 批量执行（多资产并发执行）
- [x] Task 3.4 — 执行记录存储（SQLite，分页查询）
- [x] Task 3.5 — 在线 Terminal（SSH PTY + Wails 事件推送）
- [x] Task 3.6 — xterm.js 前端集成（@xterm/xterm + @xterm/addon-fit）
- [x] Task 3.7 — 危险命令拦截（正则匹配 + 二次确认对话框）
- [x] Task 3.8 — 执行页面 UI（ExecutorPage + TerminalPage）

### 关键文件

| 文件 | 说明 |
|------|------|
| `internal/executor/model/execution.go` | 执行记录数据模型 |
| `internal/executor/ssh/pool.go` | SSH 连接池（复用连接） |
| `internal/executor/ssh/dangerous.go` | 高危命令正则检测 |
| `internal/executor/service/executor_service.go` | 命令执行服务（含批量） |
| `internal/executor/service/terminal_service.go` | PTY 终端会话管理 |
| `internal/executor/api/executor_api.go` | Wails API 绑定层 |
| `frontend/src/pages/ExecutorPage.tsx` | 命令执行页面 |
| `frontend/src/pages/TerminalPage.tsx` | xterm.js 在线终端 |

---

## 阶段 2R：资产管理重构 ⬜

**目标**：将资产管理迁移到插件化架构，支持不同类型资产的独立配置格式

**前置条件**：阶段 1-3 已完成

**估时**：4-6 天

### 核心变更

1. 新增 `internal/plugin/` 模块（插件注册表）
2. 内置插件定义（8 种：linux_server、windows_server、mysql、postgresql、redis、rocketmq、rabbitmq、kafka）
3. `assets` 表结构重构（`004_asset_refactor` 迁移）
4. Asset 数据模型新增 `category`、`plugin_type`、`ext_config` 字段，移除 `host`、`port`
5. 前端新增 `DynamicConfigForm` 组件，根据插件 Schema 动态渲染表单

### 任务拆解

#### 后端任务

- [ ] Task 2R.1 — 创建 `internal/plugin/` 模块
  - `definition.go`：PluginDef、ConfigField 数据结构定义
  - `registry.go`：Register/Get/List 接口实现
  
- [ ] Task 2R.2 — 实现 8 个内置插件定义（`internal/plugin/builtin/`）
  - `linux_server.go`：Host、Port(22)、OsType、JumpHost
  - `windows_server.go`：Host、Port(3389)、Protocol
  - `mysql.go`：Host、Port(3306)、Database、ExtraParams、SSLMode
  - `postgresql.go`：Host、Port(5432)、Database、SSLMode、Schema
  - `redis.go`：Host、Port(6379)、DB、TLS、SentinelAddrs、MasterName
  - `rocketmq.go`：NameServer、Broker、GroupID
  - `rabbitmq.go`：Host、Port(5672)、VHost、TLS
  - `kafka.go`：Brokers、SecurityProtocol、SASLMechanism

- [ ] Task 2R.3 — 数据库迁移 `004_asset_refactor`
  - 旧表备份（重命名 assets → assets_v1）
  - 创建新 assets 表（含 category、plugin_type、ext_config）
  - 数据迁移（type → category+plugin_type，host+port → ext_config JSON）
  - 创建必要索引

- [ ] Task 2R.4 — 重构 `internal/asset/model/asset.go`
  - 新增 ExtConfig 类型（map[string]interface{}，自定义 Scan/Value）
  - 新增 Tags 类型序列化（已有，确认兼容）
  - 字段调整：添加 Category、PluginType、ExtConfig，删除 Host、Port

- [ ] Task 2R.5 — 重构 `internal/asset/repository/asset_repo.go`
  - 更新 AssetFilter 结构（新增 Category、PluginType 过滤条件）
  - 更新 List 查询（旧的 type 字段改为 plugin_type）
  - 从 ExtConfig 中快照 host 字段到 Execution 记录（执行时仍需获取 host）

- [ ] Task 2R.6 — 重构 `internal/asset/service/asset_service.go`
  - 注入 plugin.Registry（验证 plugin_type 合法性）
  - 新增 GetPluginSchema / ListPlugins 方法
  - CreateAsset/UpdateAsset 时校验 ext_config 中的 required 字段

- [ ] Task 2R.7 — 重构 `internal/asset/api/asset_api.go`
  - 新增 `ListPlugins(category string)` 接口
  - 新增 `GetPluginSchema(pluginType string)` 接口
  - 更新 CreateAssetRequest / UpdateAssetRequest（ext_config 替换 host/port）
  - 在 `app.go` 中注册新 API 方法并运行 `wails generate`

- [ ] Task 2R.8 — 修复受影响的 executor 模块
  - `executor_service.go` 中获取资产 host 的方式改为从 ext_config 读取
  - 终端服务同步修改
  - 更新 Execution 记录中 asset_host 的取值逻辑

#### 前端任务

- [ ] Task 2R.9 — 更新前端类型定义 `frontend/src/types/asset.ts`
  - 新增 PluginDef、ConfigField、ConfigFieldType、SelectOption 类型
  - 更新 Asset 类型（ext_config 替换 host/port，新增 category/plugin_type）
  - 更新 CreateAssetRequest / UpdateAssetRequest

- [ ] Task 2R.10 — 实现 `DynamicConfigForm` 组件（`frontend/src/components/asset/`）
  - `DynamicField.tsx`：按 field.type 渲染对应组件（Input/Select/Switch/Textarea/TagInput）
  - `DynamicConfigForm.tsx`：遍历 schema 渲染所有字段
  - `PluginSelector.tsx`：插件类型选择（按 category 分组，图标+名称展示）

- [ ] Task 2R.11 — 重构 `AssetFormModal`（`frontend/src/pages/AssetPage.tsx` 或抽取到组件目录）
  - 步骤 1：选择 category（类别）
  - 步骤 2：选择 plugin_type（插件，按类别过滤）
  - 步骤 3：DynamicConfigForm（根据所选插件的 schema 渲染）
  - 同步更新：凭据绑定、标签输入、描述输入保留在表单中

- [ ] Task 2R.12 — 更新 `assetService.ts` 和 `assetStore.ts`
  - 新增 `listPlugins`、`getPluginSchema` 调用封装
  - Store 中新增 plugins 状态及 loadPlugins action
  - 更新 createAsset/updateAsset 请求结构

- [ ] Task 2R.13 — 更新资产列表表格
  - 展示列调整：类型列显示 category+plugin_type（图标+名称）
  - 筛选栏增加 category 和 plugin_type 过滤选项

### 验收标准

- [ ] 资产创建时可选择插件类型，表单字段按插件 Schema 自动渲染
- [ ] 不同插件类型显示不同的配置字段（如 MySQL 显示 Database/ExtraParams，Redis 显示 DB/TLS）
- [ ] 旧数据迁移正确（server → linux_server，mysql → mysql 等）
- [ ] executor 模块仍可正常执行命令（host 从 ext_config 读取）
- [ ] 新增 postgresql 插件无需修改任何现有代码，只需在 builtin/ 添加一个 go 文件

---

## 阶段 4：中间件连接器 ⬜

**目标**：统一的插件化中间件连接接口，支持数据库查询、缓存操作、MQ 消息发送

**前置条件**：阶段 2R 完成

**估时**：5-7 天

### 连接器接口（详见 `doc/design.md` 第 4.3 节）

```go
// 三种能力接口
DatabaseConnector  // Execute SQL, ListDatabases, ListTables
CacheConnector     // Command(cmd, args)
MQConnector        // SendMessage(msg)
```

### 任务拆解

- [ ] Task 4.1 — 定义连接器接口（`internal/connector/connector.go`）
  - 通用 Connector 接口（Connect/Ping/Close/TypeID）
  - DatabaseConnector 接口（Execute/ListDatabases/ListTables）
  - CacheConnector 接口（Command）
  - MQConnector 接口（SendMessage）
  - 公共数据结构（QueryResult、QueryColumn、Message、SendResult）

- [ ] Task 4.2 — 连接器工厂注册表（`internal/connector/factory.go`）
  - RegisterFactory / NewConnector 实现

- [ ] Task 4.3 — MySQL 连接器实现（`internal/connector/impl/mysql/`）
  - 从 ExtConfig 解析连接参数
  - 从 Credential 解析用户名+密码
  - 实现 DatabaseConnector 接口（支持只读限制）

- [ ] Task 4.4 — PostgreSQL 连接器实现

- [ ] Task 4.5 — Redis 连接器实现（`internal/connector/impl/redis/`）
  - 支持单机模式和 Sentinel 模式
  - 命令白名单控制

- [ ] Task 4.6 — RocketMQ 连接器实现

- [ ] Task 4.7 — RabbitMQ 连接器实现

- [ ] Task 4.8 — Kafka 连接器实现

- [ ] Task 4.9 — ConnectorService 实现（`internal/connector/service/`）
  - TestConnection（通用连接测试）
  - ExecuteSQL（注入 AuditService 记录操作）
  - ExecuteRedisCmd
  - SendMQMessage

- [ ] Task 4.10 — ConnectorAPI（Wails 绑定）
  - TestConnection / ExecuteSQL / ListDatabases / ListTables
  - ExecuteRedisCmd
  - SendMQMessage
  - 在 `app.go` 中注册并生成绑定

- [ ] Task 4.11 — 前端 ConnectorPage 实现
  - 数据库查询标签页（SQL 输入框 + 结果表格 + 库表浏览器）
  - 缓存操作标签页（命令输入 + 结构化结果展示）
  - MQ 消息发送标签页（消息模板 + 发送历史）

### 验收标准

- [ ] 可通过 UI 对 MySQL 执行只读 SQL 并查看结果
- [ ] 可通过 UI 对 Redis 执行 GET/HGETALL/SCAN 等命令
- [ ] 可向 RocketMQ/RabbitMQ/Kafka 发送消息并获得回执
- [ ] 连接测试功能可正常使用
- [ ] 新增数据库插件（如 MongoDB）只需实现 DatabaseConnector 并注册工厂

---

## 阶段 5：DNS 服务 ⬜

**目标**：内置轻量 DNS 服务器，支持环境隔离解析

**前置条件**：阶段 2R 完成

**估时**：3-4 天

### 数据模型

```
DNSRecord: id, environment_id, asset_id, domain, record_type(A|CNAME), value, ttl, enabled
```

### 任务拆解

- [ ] Task 5.1 — DNSRecord 模型与数据库迁移（`005_dns`）
- [ ] Task 5.2 — DNS 记录 Repository/Service/API
- [ ] Task 5.3 — DNS 服务器实现（`miekg/dns`）
  - A/CNAME 记录解析
  - 按环境隔离逻辑
  - 未命中时转发到上游 DNS
- [ ] Task 5.4 — DNS 查询日志记录
- [ ] Task 5.5 — DNS 管理页面 UI（域名列表 + 添加/编辑 + 查询日志）

### 核心逻辑

资产 ext_config.host → DNS A 记录 value（通过 asset_id 关联自动取 host）

---

## 阶段 6：健康检查 ⬜

**目标**：定时资产健康监控，采集并存储各类健康指标

**前置条件**：阶段 2R 完成

**估时**：3-4 天

### 检查指标

| 指标 | 方式 | 适用类型 |
|------|------|---------|
| Ping 延迟 | ICMP | 所有类型 |
| TCP 端口 | net.Dial | 所有类型 |
| CPU/内存/磁盘 | SSH 执行 top/free/df | server 类 |
| 数据库连接 | Connector.Ping | database 类 |
| 缓存连接 | Connector.Ping | cache 类 |
| MQ 连接 | Connector.Ping | mq 类 |

### 任务拆解

- [ ] Task 6.1 — HealthSnapshot 模型与迁移（`006_health`）
- [ ] Task 6.2 — 各指标检查器实现
  - ICMP Ping 检查器
  - TCP 端口检查器
  - SSH 系统指标检查器（服务器类）
  - Connector Ping 检查器（中间件类，复用 connector 模块）
- [ ] Task 6.3 — 定时调度器（可配置间隔，支持按环境/类别过滤检查范围）
- [ ] Task 6.4 — 健康状态聚合逻辑（healthy/warning/critical/unreachable 判定规则）
- [ ] Task 6.5 — HealthAPI（Wails 绑定）
- [ ] Task 6.6 — 健康看板 UI（状态总览 + 异常高亮 + 历史趋势）

---

## 阶段 7：审计系统 ⬜

**目标**：全量操作审计日志，支持多维度查询

**前置条件**：阶段 2R 完成（其他模块注入审计服务）

**估时**：2-3 天

### 数据模型

```
AuditLog: id, operator, action_type, resource_type, resource_id, resource_name, detail(JSON), result, created_at
```

### 操作类型

| ActionType | 触发模块 |
|-----------|---------|
| `ssh_cmd` | executor |
| `sql` | connector（database 类） |
| `redis` | connector（cache 类） |
| `mq` | connector（mq 类） |
| `config_change` | config |
| `credential_view` | asset（明文查看凭据） |
| `asset_crud` | asset（创建/更新/删除资产） |

### 任务拆解

- [ ] Task 7.1 — AuditLog 模型与迁移（`007_audit`）
- [ ] Task 7.2 — AuditService 实现（写入接口，设计为异步写入避免阻塞）
- [ ] Task 7.3 — 各模块注入 AuditService（executor/connector/asset）
- [ ] Task 7.4 — AuditAPI（分页查询 + 多维度筛选）
- [ ] Task 7.5 — 审计日志页面 UI（时间线展示 + 筛选 + 导出）

---

## 阶段 8：配置系统 ⬜

**目标**：YAML 配置管理 + 版本快照 + 回滚 + 可视化编辑

**前置条件**：无（独立模块，可与其他阶段并行）

**估时**：2-3 天

### 数据模型

```
ConfigSnapshot: id, version, content(YAML全文), comment, created_by, created_at
```

### 任务拆解

- [ ] Task 8.1 — ConfigSnapshot 模型与迁移（`008_config`）
- [ ] Task 8.2 — 配置读取 + 校验（扩展已有 config_service，补充字段验证）
- [ ] Task 8.3 — 配置写入 + 自动创建版本快照
- [ ] Task 8.4 — 配置版本列表查询 + 版本内容 diff 展示
- [ ] Task 8.5 — 配置回滚（选定版本恢复）
- [ ] Task 8.6 — 配置管理页面 UI
  - 表单化编辑（字段分组展示）
  - 敏感字段脱敏
  - 版本历史侧边栏 + diff 对比

---

## 里程碑检查点

### M1 检查点（阶段 2R + 3 + 4 完成后）

- [ ] 资产管理支持所有 8 种插件类型，表单字段动态渲染
- [ ] 服务器命令执行（单机/批量）正常工作
- [ ] 在线终端可正常使用
- [ ] MySQL/Redis 数据查询可用
- [ ] MQ 消息发送（至少 1 种 MQ）可用

### M2 检查点（全部阶段完成后）

- [ ] DNS 解析正常工作（A 记录）
- [ ] 健康看板展示所有类型资产的状态
- [ ] 关键操作全部可在审计日志中查询
- [ ] 配置管理支持版本快照与回滚
- [ ] 验收标准（req.md 第 11 节）全部通过

# EnvPilot 开发进度文档

> 本文档记录所有开发阶段的目标、任务拆解和完成状态。
> 每个阶段开始前更新计划，完成后更新状态。
> 详细的系统设计请参考 `doc/design.md`，需求规格请参考 `req.md`。
>
> **当前架构**：桌面模式（Wails）+ 服务端模式（HTTP/SSE/WebSocket）双模式，共享 `internal/` 业务逻辑。

---

## 技术栈速查

| 层次 | 技术 | 版本 |
|------|------|------|
| 桌面容器 | Wails | v2.11.0 |
| HTTP 服务 | Go 标准库 net/http | 1.22+ 路径参数语法 |
| 后端语言 | Go | 1.24 |
| 前端框架 | React + TypeScript | 18 / 5 |
| 样式系统 | TailwindCSS + shadcn/ui | v4 |
| 状态管理 | Zustand | latest |
| 路由 | React Router DOM | v7 |
| 本地数据库 | SQLite (GORM) | - |
| 日志 | zap + lumberjack | - |
| SSH | golang.org/x/crypto/ssh | - |
| 加密 | AES-256-GCM + PBKDF2 | - |
| WebSocket（服务端） | gorilla/websocket | - |
| 实时推流 | SSE（服务端）/ Wails EventsEmit（桌面） | - |

---

## 模块目录速查

```
internal/
├── app/         共享初始化容器 Bootstrap()（无 Wails 依赖）
├── plugin/      插件注册表（PluginDef / Registry）
├── asset/       资产管理（环境/分组/资产/凭据）
├── executor/    SSH 命令执行 + 在线终端
├── connector/   中间件连接器（插件化，待实现）
├── dns/         内置 DNS 服务（待实现）
├── health/      健康检查（待实现）
├── audit/       操作审计（待实现）
├── config/      系统配置
└── auth/        本地认证（待实现）

api/             HTTP handler 层（服务端模式专用）
├── router.go            路由注册 + CORS + SPA fallback
├── asset_handler.go     资产管理 REST handler
├── executor_handler.go  命令执行 / SSE 流 / WebSocket 终端
├── event_bus.go         进程内发布订阅总线
└── util.go              JSON 响应工具

cmd/
└── server/      服务端模式独立入口 + 静态资源内嵌

pkg/
├── crypto/      AES-256 加解密 + PBKDF2 密钥派生
├── event/       EventEmitter 接口（解耦 Wails / HTTP 事件推送）
└── logger/      全局日志（zap）

database/
├── db.go                   SQLite 连接初始化
└── migration/              版本化迁移（schema_migrations 追踪）
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
// ✅ 正确：通过 services/ 封装（内部自动切换桌面/服务端模式）
import { listAssets, listPlugins } from '@/services/assetService'

// ❌ 错误：直接调用 wailsjs（服务端模式不可用）
import { ListAssets } from '@/wailsjs/go/assetapi/AssetAPI'
```

所有 `services/*.ts` 内部通过 `IS_SERVER_MODE` 常量切换调用方式：

```typescript
// 桌面模式：调用 Wails IPC 绑定
// 服务端模式：调用 apiClient.http（标准 REST）
export async function listAssets(filter?: AssetFilter) {
  if (IS_SERVER_MODE) return apiClient.http.get('/api/assets', filter)
  return AssetAPIJs.ListAssets(filter).then(unwrap)
}
```

### 数据库迁移

每个阶段在 `database/migration/migrations/` 下新增迁移文件，并在 `migrator.go` 中注册：

```go
m.add("004_asset_refactor", migrateAssetRefactor)
```

迁移文件编号全局递增，不允许修改已执行的迁移。

### Wails API 绑定（桌面模式）

所有 Wails 绑定方法使用 `Result[T]` 泛型包装响应；HTTP 接口同样使用相同结构体：

```go
type Result[T any] struct {
    Success bool   `json:"success"`
    Data    T      `json:"data,omitempty"`
    Message string `json:"message,omitempty"`
}
```

### 事件推送

业务逻辑层不依赖具体的事件实现，统一使用 `event.Emitter` 接口：

```go
// pkg/event/emitter.go
type Emitter interface {
    Emit(event string, data interface{})
}
```

- **桌面模式**：`executor_api.go` 创建 `WailsEmitter`，内部调用 `wailsruntime.EventsEmit`
- **服务端模式**：`api/executor_handler.go` 创建 `BusEmitter`，内部向 `EventBus` 发布；SSE handler 订阅并推流到浏览器

### 数据库迁移

每个阶段在 `database/migration/migrations/` 下新增迁移文件，并在 `migrator.go` 中注册。`schema_migrations` 表追踪已执行记录，每个迁移只执行一次：

```go
m.add("004_dns", migrateDNS)
```

迁移文件编号全局递增，**不允许修改已执行的迁移**。

---

## 阶段总览

| 阶段 | 名称 | 状态 | 说明 |
|------|------|------|------|
| 阶段 1 | 项目初始化 | ✅ 完成 | 工程骨架、基础设施 |
| 阶段 2 | 资产管理系统（初版） | ✅ 完成 | 旧数据模型，已被阶段 2R 替代 |
| 阶段 3 | 服务器执行系统 | ✅ 完成 | SSH 命令执行 + 在线终端 |
| **阶段 2R** | **资产管理重构** | ✅ 完成 | 插件化架构 + 新数据模型 |
| **阶段 D** | **双模式部署支持** | ✅ 完成 | 桌面（Wails）+ 服务端（HTTP）双模式 |
| 阶段 4 | 中间件连接器 | ⬜ 待开始 | 依赖阶段 2R 完成 |
| 阶段 5 | DNS 服务 | ⬜ 待开始 | 依赖阶段 2R 完成 |
| 阶段 6 | 健康检查 | ⬜ 待开始 | 依赖阶段 2R 完成 |
| 阶段 7 | 审计系统 | ⬜ 待开始 | 依赖阶段 2R 完成 |
| 阶段 8 | 配置系统 | ⬜ 待开始 | 独立模块 |

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
| `main.go` | 桌面模式入口，Wails 窗口配置 |
| `app.go` | Wails 生命周期回调 + 基础 API（Ping/GetVersion） |
| `internal/app/container.go` | 共享初始化容器 Bootstrap()，无 Wails 依赖 |
| `config/config.yaml` | 系统配置文件 |
| `pkg/crypto/aes.go` | AES-256-GCM 加解密 |
| `pkg/crypto/key_derive.go` | PBKDF2 密钥派生 |
| `pkg/logger/logger.go` | 全局日志 |
| `database/db.go` | SQLite 连接初始化 |
| `database/migration/migrator.go` | 版本化迁移执行器（schema_migrations 追踪） |
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

## 阶段 2R：资产管理重构 ✅

**目标**：将资产管理迁移到插件化架构，支持不同类型资产的独立配置格式

**前置条件**：阶段 1-3 已完成

### 核心变更

1. 新增 `internal/plugin/` 模块（插件注册表）
2. 内置插件定义（8 种：linux_server、windows_server、mysql、postgresql、redis、rocketmq、rabbitmq、kafka）
3. `assets` 表结构重构（直接重建，不兼容旧数据）
4. Asset 数据模型新增 `category`、`plugin_type`、`ext_config` 字段，移除 `host`、`port`
5. 前端新增 `DynamicConfigForm` 组件，根据插件 Schema 动态渲染表单

### 完成内容

#### 后端

- [x] Task 2R.1 — 创建 `internal/plugin/` 模块
  - `definition.go`：PluginDef、ConfigField 数据结构定义
  - `registry.go`：Register/Get/List 接口实现
  
- [x] Task 2R.2 — 实现 8 个内置插件定义（`internal/plugin/builtin/`）
  - `linux_server.go`：Host、Port(22)、OsType、JumpHost
  - `windows_server.go`：Host、Port(3389)、Protocol
  - `mysql.go`：Host、Port(3306)、Database、ExtraParams、SSLMode
  - `postgresql.go`：Host、Port(5432)、Database、SSLMode、Schema
  - `redis.go`：Host、Port(6379)、DB、TLS、SentinelAddrs、MasterName
  - `rocketmq.go`：NameServer、Broker、GroupID
  - `rabbitmq.go`：Host、Port(5672)、VHost、TLS
  - `kafka.go`：Brokers、SecurityProtocol、SASLMechanism

- [x] Task 2R.3 — 数据库迁移（在 `002_asset.go` 中 DROP TABLE 后重建，迁移系统确保只执行一次）

- [x] Task 2R.4 — 重构 `internal/asset/model/asset.go`（ExtConfig、Tags 自定义 Scan/Value）

- [x] Task 2R.5 — 重构 `internal/asset/repository/asset_repo.go`（Category/PluginType 过滤）

- [x] Task 2R.6 — 重构 `internal/asset/service/asset_service.go`（注入 PluginRegistry、ListPlugins/GetPluginSchema）

- [x] Task 2R.7 — 重构 `internal/asset/api/asset_api.go`（ListPlugins / GetPluginSchema 接口）

- [x] Task 2R.8 — 修复 executor 模块：从 `ext_config.host/port` 读取连接参数；命令执行使用 `bash -lc` 解决 PATH 问题

#### 前端

- [x] Task 2R.9 — 更新 `frontend/src/types/asset.ts`（PluginDef、ConfigField、Asset 重构）

- [x] Task 2R.10 — 实现 `DynamicConfigForm` 组件（`frontend/src/components/asset/DynamicConfigForm.tsx`）

- [x] Task 2R.11 — 重构 `AssetPage.tsx`（分步选择 category → plugin → DynamicConfigForm）

- [x] Task 2R.12 — 更新 `assetService.ts` 和 `assetStore.ts`（listPlugins、getPluginSchema）

- [x] Task 2R.13 — 资产列表表格展示 category+plugin_type，支持过滤

### 关键文件

| 文件 | 说明 |
|------|------|
| `internal/plugin/definition.go` | PluginDef、ConfigField 结构 |
| `internal/plugin/registry.go` | Register / Get / List |
| `internal/plugin/builtin/` | 8 个内置插件定义（`init()` 自注册） |
| `internal/asset/model/asset.go` | 新版 Asset 模型（ExtConfig JSON 字段） |
| `internal/asset/service/asset_service.go` | 业务逻辑（含插件校验） |
| `frontend/src/components/asset/DynamicConfigForm.tsx` | 动态表单渲染 |
| `frontend/src/pages/AssetPage.tsx` | 资产管理页面（重构版） |

---

## 阶段 D：双模式部署支持 ✅

**目标**：在保留 Wails 桌面模式的同时，支持以独立 HTTP 服务器形式部署，两种模式共享 `internal/` 全部业务逻辑

**前置条件**：阶段 1、2R、3 已完成

### 架构方案

核心思路是"解耦入口层，共享逻辑层"：

```
main.go（Wails）          cmd/server/main.go（HTTP）
     │                           │
     ▼                           ▼
   app.go                   api/router.go
(Wails 生命周期)          (HTTP/SSE/WebSocket)
     │                           │
     └──────────┬────────────────┘
                ▼
      internal/app/container.go
         Bootstrap()（共享初始化）
                │
     ┌──────────┴──────────┐
     ▼                     ▼
internal/asset/      internal/executor/
 (业务逻辑)           (业务逻辑)
```

事件推送通过 `pkg/event.Emitter` 接口抽象：
- **桌面**：`WailsEmitter` → `wailsruntime.EventsEmit`
- **服务端**：`BusEmitter` → `EventBus` pub/sub → SSE 推送到浏览器

### 完成内容

#### Go 后端

- [x] Task D.1 — `pkg/event/emitter.go`：定义 `Emitter` 接口 + `Noop` 实现

- [x] Task D.2 — `executor_service.go` / `terminal_service.go`：移除 `wailsruntime` 导入，改为接受 `event.Emitter` 参数

- [x] Task D.3 — `internal/executor/api/executor_api.go`：添加 `WailsEmitter` 实现，在 Wails 调用时传入

- [x] Task D.4 — `internal/app/container.go`：`Bootstrap()` 集中初始化所有服务，无 Wails 依赖

- [x] Task D.5 — `app.go` 精简：使用 `container.Bootstrap()`，只保留 Wails 生命周期代码

- [x] Task D.6 — `api/event_bus.go`：进程内 pub/sub 总线 + `BusEmitter`

- [x] Task D.7 — `api/asset_handler.go`：资产管理全部 REST handler

- [x] Task D.8 — `api/executor_handler.go`：命令执行（POST）、SSE 输出流（GET）、WebSocket 终端（GET）

- [x] Task D.9 — `api/router.go`：`http.NewServeMux` 路由 + CORS 中间件 + SPA fallback

- [x] Task D.10 — `cmd/server/main.go`：服务端入口；`cmd/server/embed.go`：嵌入前端静态资源

#### 前端

- [x] Task D.11 — `frontend/src/vite-env.d.ts`：声明 `__APP_MODE__` / `__API_BASE__` 类型

- [x] Task D.12 — `frontend/vite.config.ts`：支持 `--mode server` 构建，输出 `dist-server/`，注入全局常量

- [x] Task D.13 — `frontend/package.json`：新增 `build:server` / `dev:server` 脚本

- [x] Task D.14 — `frontend/src/lib/apiClient.ts`：HTTP REST、WebSocket URL、SSE 订阅、WebSocket 终端管理

- [x] Task D.15 — `frontend/src/lib/wailsRuntime.ts`：Wails 事件安全封装（浏览器环境降级为 no-op）

- [x] Task D.16 — `frontend/src/hooks/useWailsReady.ts`：服务端模式直接 ready，桌面模式等待 Wails 桥接

- [x] Task D.17 — `services/backendService.ts` / `assetService.ts` / `executorService.ts`：双模式 `IS_SERVER_MODE` 分支

- [x] Task D.18 — `frontend/src/pages/TerminalPage.tsx`：服务端使用 WebSocket，桌面使用 Wails IPC

#### 构建

- [x] Task D.19 — `Makefile`：`build-desktop` / `build-server` / `build-server-linux` / `dev` / `dev-server` / `clean`

### 关键文件

| 文件 | 说明 |
|------|------|
| `pkg/event/emitter.go` | 事件发射接口，解耦 Wails / HTTP |
| `internal/app/container.go` | 共享服务初始化（Bootstrap） |
| `api/router.go` | HTTP 路由（服务端专用） |
| `api/executor_handler.go` | SSE 命令流 + WebSocket 终端 |
| `api/event_bus.go` | 进程内 pub/sub |
| `cmd/server/main.go` | 服务端二进制入口 |
| `frontend/src/lib/apiClient.ts` | 前端 HTTP/WS/SSE 客户端 |
| `frontend/src/lib/wailsRuntime.ts` | 浏览器安全 Wails 事件封装 |
| `Makefile` | 双模式构建脚本 |

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

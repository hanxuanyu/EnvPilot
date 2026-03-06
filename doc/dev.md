# EnvPilot 开发进度文档

> 本文档记录所有开发阶段的目标、任务拆解和完成状态。
> 每个阶段开始前更新计划，完成后更新状态。

---

## 技术栈速查

| 层次 | 技术 | 版本 |
|------|------|------|
| 桌面容器 | Wails | v2.11.0 |
| 后端语言 | Go | 1.24 |
| 前端框架 | React + TypeScript | 18 / 5 |
| 样式系统 | TailwindCSS | v4 |
| 状态管理 | Zustand | latest |
| 路由 | React Router DOM | v6 |
| 本地数据库 | SQLite (GORM) | - |
| 日志 | zap + lumberjack | - |
| SSH | golang.org/x/crypto/ssh | - |
| 加密 | AES-256-GCM + PBKDF2 | - |

---

## 模块目录速查

```
internal/
├── asset/       资产管理（环境/分组/资产/凭据）
├── executor/    SSH 命令执行
├── terminal/    在线 Terminal（WebSocket + PTY）
├── connector/   中间件连接器（MySQL/Redis/MQ）
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

## 阶段总览

| 阶段 | 名称 | 状态 |
|------|------|------|
| 阶段 1 | 项目初始化 | ✅ 完成 |
| 阶段 2 | 资产管理系统 | ✅ 完成 |
| 阶段 3 | 服务器执行系统 | 🚧 进行中 |
| 阶段 4 | 中间件连接器 | ⬜ 待开始 |
| 阶段 5 | DNS 服务 | ⬜ 待开始 |
| 阶段 6 | 健康检查 | ⬜ 待开始 |
| 阶段 7 | 审计系统 | ⬜ 待开始 |
| 阶段 8 | 配置系统 | ⬜ 待开始 |

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
- [x] Task 1.8 — Wails 绑定验证（Ping/GetVersion 接口，Dashboard 显示连接状态）
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
| `internal/config/service/config_service.go` | 配置服务 |
| `frontend/src/App.tsx` | 前端路由配置 |
| `frontend/src/components/common/Layout.tsx` | 主布局 |
| `frontend/src/components/common/Sidebar.tsx` | 侧边栏导航 |

---

## 阶段 2：资产管理系统 ✅

**目标**：实现完整的资产 CRUD 管理体系

### 需要实现的数据模型

```
Environment（环境）
  - id, name, description, color, created_at

Group（分组）
  - id, environment_id, name, description, created_at

Asset（资产）
  - id, group_id, environment_id
  - type: server | mysql | redis | rocketmq | rabbitmq
  - name, host, port, tags
  - credential_id（关联凭据）
  - status, created_at

Credential（凭据）
  - id, name, type: password | ssh_key | token
  - username
  - secret（AES-256 加密存储）
  - created_at
```

### 任务拆解

- [x] Task 2.1 — 数据模型定义（4 个 model）
- [x] Task 2.2 — 数据库迁移（002_asset）
- [x] Task 2.3 — Repository 层（4 个 repo，CRUD + 搜索）
- [x] Task 2.4 — Service 层（业务逻辑，含凭据加密/脱敏）
- [x] Task 2.5 — API 层（Wails 绑定接口）
- [x] Task 2.6 — 前端 Store（Zustand 状态管理）
- [x] Task 2.7 — 环境管理页面（EnvironmentPage）
- [x] Task 2.8 — 资产列表页面（AssetPage）
- [x] Task 2.9 — 凭据管理（嵌入资产管理，脱敏显示）

### 验收标准

- 环境 CRUD 操作正常
- 资产 CRUD + 搜索正常
- 凭据加密存储，查看需二次确认
- 前端列表页面可用

---

## 阶段 3：服务器执行系统 ⬜

**目标**：SSH 命令执行 + 在线 Terminal

### 需要实现

```
Execution（执行记录）
  - id, asset_id, command, output, exit_code
  - started_at, finished_at, operator
```

### 任务拆解

- [ ] Task 3.1 — SSH 连接管理（连接池，复用连接）
- [ ] Task 3.2 — 单条命令执行（实时输出流）
- [ ] Task 3.3 — 批量执行（多资产并发执行）
- [ ] Task 3.4 — 执行记录存储
- [ ] Task 3.5 — 在线 Terminal（WebSocket + SSH PTY）
- [ ] Task 3.6 — xterm.js 前端集成
- [ ] Task 3.7 — 危险命令拦截（高风险命令二次确认）
- [ ] Task 3.8 — 执行页面 UI

### 技术重点

- `golang.org/x/crypto/ssh` 实现 SSH 客户端
- Wails WebSocket 或 EventEmit 实现实时输出
- xterm.js 终端渲染

---

## 阶段 4：中间件连接器 ⬜

**目标**：统一的中间件连接接口

### 连接器接口定义

```go
type Connector interface {
    Connect() error
    Ping() error
    Execute(cmd string) (interface{}, error)
    Close() error
}
```

### 实现类型

| 类型 | 功能 |
|------|------|
| MySQL | 连接测试、库表浏览、SQL 查询（默认只读） |
| Redis | 常用命令执行、命令白名单控制 |
| RocketMQ | 消息发送、消息模板 |
| RabbitMQ | 消息发送、队列管理 |

### 任务拆解

- [ ] Task 4.1 — Connector 接口定义
- [ ] Task 4.2 — MySQL 连接器（go-sql-driver）
- [ ] Task 4.3 — Redis 连接器（go-redis）
- [ ] Task 4.4 — RocketMQ 连接器
- [ ] Task 4.5 — RabbitMQ 连接器
- [ ] Task 4.6 — 连接器 API 层
- [ ] Task 4.7 — 前端连接器页面（分 Tab）

---

## 阶段 5：DNS 服务 ⬜

**目标**：内置轻量 DNS 服务器

### 数据模型

```
DNSRecord
  - id, environment_id
  - domain, record_type: A|CNAME
  - value（IP 或目标域名）
  - ttl, enabled
```

### 任务拆解

- [ ] Task 5.1 — DNS 记录模型与迁移
- [ ] Task 5.2 — DNS 服务器实现（miekg/dns）
- [ ] Task 5.3 — 环境隔离逻辑（按环境分组解析）
- [ ] Task 5.4 — 上游 DNS 转发（未命中时转发）
- [ ] Task 5.5 — DNS 查询日志
- [ ] Task 5.6 — DNS 管理页面

### 核心逻辑

`service-domain → asset-host`（域名映射到资产 IP）

---

## 阶段 6：健康检查 ⬜

**目标**：定时资产健康监控

### 检查指标

| 指标 | 方式 |
|------|------|
| Ping 延迟 | ICMP |
| TCP 端口 | net.Dial |
| CPU 使用率 | SSH 执行 top/vmstat |
| 内存使用率 | SSH 执行 free |
| 磁盘使用率 | SSH 执行 df |

### 数据模型

```
HealthSnapshot
  - id, asset_id, checked_at
  - ping_ms, tcp_ok
  - cpu_percent, mem_percent, disk_percent
  - status: healthy | warning | critical | unreachable
```

### 任务拆解

- [ ] Task 6.1 — HealthSnapshot 模型与迁移
- [ ] Task 6.2 — 各指标检查器实现
- [ ] Task 6.3 — 定时调度器（可配置间隔）
- [ ] Task 6.4 — 健康状态聚合逻辑
- [ ] Task 6.5 — 健康看板 UI

---

## 阶段 7：审计系统 ⬜

**目标**：全量操作审计日志

### 数据模型

```
AuditLog
  - id, operator（操作者）
  - action_type: ssh_cmd | sql | redis | mq | config_change
  - resource_type, resource_id, resource_name
  - detail（操作内容，JSON）
  - result: success | failure
  - ip, created_at
```

### 需要记录的操作

- SSH 命令执行（命令内容 + 输出摘要）
- SQL 查询执行
- Redis 命令执行
- MQ 消息发送
- 配置变更（diff）
- 凭据查看

### 任务拆解

- [ ] Task 7.1 — AuditLog 模型与迁移
- [ ] Task 7.2 — AuditService（写入接口）
- [ ] Task 7.3 — 各模块注入 AuditService
- [ ] Task 7.4 — 审计日志查询（分页 + 筛选）
- [ ] Task 7.5 — 审计日志页面 UI

---

## 阶段 8：配置系统 ⬜

**目标**：YAML 配置管理 + 版本快照 + 回滚

### 数据模型

```
ConfigSnapshot
  - id, version, content（YAML 全文）
  - created_at, created_by
  - comment（变更说明）
```

### 任务拆解

- [ ] Task 8.1 — ConfigSnapshot 模型与迁移
- [ ] Task 8.2 — 配置读取 + 校验（已有基础，扩展）
- [ ] Task 8.3 — 配置写入 + 快照保存
- [ ] Task 8.4 — 配置版本列表与 diff 展示
- [ ] Task 8.5 — 配置回滚功能
- [ ] Task 8.6 — 配置管理页面 UI

---

## 跨阶段约定

### 错误处理规范

```go
// 所有 service 方法返回带上下文的错误
return fmt.Errorf("操作描述失败: %w", err)
```

### 审计注入规范

各 service 构造函数接受 `*audit.AuditService`，在关键操作后调用：

```go
auditSvc.Record(ctx, audit.ActionSSHCmd, ...)
```

### 凭据处理规范

- 存入：`cipher.Encrypt(plaintext)` → 存 DB
- 读出展示：`maskSecret(value)` → 脱敏
- 读出使用：`cipher.Decrypt(encrypted)` → 明文（仅在 service 内部使用）

### 前端 API 调用规范

```typescript
// services/ 下统一封装，页面不直接调用 wailsjs
import { listAssets } from '@/services/assetService'
```

### 数据库迁移规范

每个新阶段在 `database/migration/` 下添加对应迁移文件，并在 `migrator.go` 中注册：

```go
m.add("002_asset", migrateAsset)
```

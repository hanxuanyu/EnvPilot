# EnvPilot 需求文档

## 1. 文档信息

| 字段 | 内容 |
|------|------|
| 项目名称 | EnvPilot |
| 技术栈 | Go + React + shadcn/ui + Tailwind CSS + Wails |
| 文档版本 | v0.2 |
| 日期 | 2026-03-06 |
| 状态 | 评审中 |
| 变更说明 | 重构资产数据模型，引入插件化中间件架构，类型专属配置改用扩展字段存储 |

---

## 2. 背景与目标

### 2.1 背景

在多环境（开发、测试、预发、生产等）运维场景中，服务器与中间件数量增长快，信息分散在文档、脚本、命令行历史和人员经验中，导致以下问题：

- 查询与操作入口不统一，切换成本高。
- 高风险操作缺乏统一审计。
- 环境内对象多、命名混乱，定位慢。
- 多套网络下地址不统一，连接方式复杂。
- 中间件类型繁多（MySQL、PostgreSQL、Redis、Kafka、RocketMQ、RabbitMQ 等），统一管理困难。

### 2.2 目标

构建一个桌面端管理工具，统一管理多环境下的服务器和各类中间件，提供高频运维能力：

- 快速执行服务器命令/脚本。
- 快速连接查询各类数据库/缓存。
- 快速发送 MQ 消息。
- 为服务配置域名并通过内置 DNS 服务完成解析。
- 按环境分组组织资产，提高可视化和检索效率。
- 通过插件化架构快速扩展对新中间件类型的支持。

### 2.3 非目标（当前阶段）

- 不替代企业级堡垒机。
- 不提供完整 CI/CD 流水线能力。
- 不作为公网权威 DNS 服务。

---

## 3. 用户角色与使用场景

### 3.1 角色

- **管理员**：最高权限，负责环境、资产、凭据、域名、DNS、审计与系统配置管理。
- **普通只读用户**：无需登录即可查看所有环境配置和运行状态，不具备新增、修改、删除、执行操作权限。

### 3.2 典型场景

- **场景 A**：在"测试环境"批量执行日志采集脚本。
- **场景 B**：在"预发环境"快速查询某业务库中的订单记录（MySQL/PostgreSQL）。
- **场景 C**：向指定 MQ Topic/Queue 发送测试消息并查看回执（RocketMQ/Kafka/RabbitMQ）。
- **场景 D**：通过内置 DNS 域名快速访问服务，无需记忆 IP/端口。
- **场景 E**：为新接入的中间件类型快速配置连接信息，无需修改核心代码。

---

## 4. 业务对象与术语

| 术语 | 定义 |
|------|------|
| 环境（Environment） | 一组隔离的资源集合，如 dev/test/staging/prod |
| 分组（Group） | 环境内的逻辑分类，如"核心服务""数据层""缓存层" |
| 资产（Asset） | 可管理对象，分为服务器与各类中间件实例 |
| 资产类别（AssetCategory） | 高层次分类：服务器、数据库、缓存、消息队列、其他 |
| 插件类型（PluginType） | 具体技术实现标识：`linux_server`、`mysql`、`redis`、`rocketmq` 等 |
| 扩展配置（ExtConfig） | JSON 格式存储的资产类型专属配置字段 |
| 凭据（Credential） | 认证信息（用户名+密码 / SSH 密钥 / Token），加密存储，可跨资产复用 |
| 插件（Plugin） | 中间件类型的配置 Schema 与连接器实现的组合单元 |
| 服务域名（Service Domain） | 为资产或服务绑定的 DNS 名称 |
| 操作记录（Operation Log） | 命令、查询、消息发送等行为审计记录 |

---

## 5. 功能需求

### 5.1 环境与分组管理

1. 支持创建/编辑/删除环境（名称、颜色、描述）。
2. 支持环境排序与启用/禁用。
3. 每个环境下支持单级分组，降低复杂度。
4. 支持将各类资产归类到分组。
5. 支持跨分组检索（按名称、标签、类型、域名）。

### 5.2 资产管理（核心重构需求）

#### 5.2.1 统一资产模型

所有资产共享公共字段，类型专属配置统一通过 **扩展配置（ExtConfig）** JSON 字段存储：

**公共字段（数据库独立列）**：

| 字段 | 说明 |
|------|------|
| id | 主键 |
| environment_id | 所属环境 |
| group_id | 所属分组（可选） |
| category | 资产类别：`server` / `database` / `cache` / `mq` / `other` |
| plugin_type | 插件类型标识：`linux_server` / `mysql` / `redis` / `rocketmq` 等 |
| name | 资产名称 |
| description | 备注描述 |
| tags | 标签列表（JSON 数组） |
| credential_id | 绑定凭据（可选，跨资产复用） |
| status | 健康状态：`unknown` / `online` / `offline` / `warning` |
| last_checked_at | 最后检查时间 |
| ext_config | **类型专属配置（JSON）** |

**注意**：`host`、`port` 等连接参数属于类型相关字段，统一存入 `ext_config`，不在主表单独建列。

#### 5.2.2 插件化架构

中间件类型采用插件化设计，分两个层次：

1. **类别（Category）**：高层次抽象（数据库、缓存、MQ），体现共同能力特征。
2. **插件（Plugin）**：具体技术实现，在类别下注册。

内置插件（首批）：

| 类别 | 插件 ID | 显示名称 | 默认端口 |
|------|---------|---------|---------|
| server | `linux_server` | Linux 服务器 | 22 |
| server | `windows_server` | Windows 服务器 | 3389 |
| database | `mysql` | MySQL | 3306 |
| database | `postgresql` | PostgreSQL | 5432 |
| cache | `redis` | Redis | 6379 |
| mq | `rocketmq` | RocketMQ | 9876 |
| mq | `rabbitmq` | RabbitMQ | 5672 |
| mq | `kafka` | Kafka | 9092 |

后续可通过插件注册表快速扩展更多类型，无需修改核心业务逻辑。

#### 5.2.3 各插件配置字段（ExtConfig）

**linux_server**：
```json
{
  "host": "192.168.1.1",
  "port": 22,
  "os_type": "linux",
  "protocol": "ssh",
  "jump_host": ""
}
```

**windows_server**：
```json
{
  "host": "192.168.1.2",
  "port": 3389,
  "protocol": "rdp"
}
```

**mysql**：
```json
{
  "host": "db.example.com",
  "port": 3306,
  "database": "app_db",
  "extra_params": "charset=utf8mb4&parseTime=true",
  "ssl_mode": "disable"
}
```

**postgresql**：
```json
{
  "host": "pg.example.com",
  "port": 5432,
  "database": "app_db",
  "ssl_mode": "disable",
  "schema": "public"
}
```

**redis**：
```json
{
  "host": "cache.example.com",
  "port": 6379,
  "db": 0,
  "tls": false,
  "sentinel_addrs": [],
  "master_name": ""
}
```

**rocketmq**：
```json
{
  "name_server": "mq.example.com:9876",
  "broker": "broker-a",
  "group_id": "consumer_group",
  "access_key": "",
  "secret_key": ""
}
```

**rabbitmq**：
```json
{
  "host": "mq.example.com",
  "port": 5672,
  "vhost": "/",
  "tls": false
}
```

**kafka**：
```json
{
  "brokers": "kafka1:9092,kafka2:9092",
  "security_protocol": "PLAINTEXT",
  "sasl_mechanism": ""
}
```

#### 5.2.4 凭据管理

- 凭据与资产解耦，支持一个凭据被多个资产引用。
- 支持凭据类型：`password`（用户名+密码）、`ssh_key`（SSH 私钥）、`token`（API Token/连接密码）。
- 所有凭据加密存储（AES-256-GCM），页面默认脱敏展示，管理员可按需临时明文查看（需二次确认）。

### 5.3 服务器管理

1. 通过 `linux_server` / `windows_server` 插件管理服务器。
2. ExtConfig 存储连接信息（Host、Port、协议类型、跳板机）。
3. 凭据通过 `credential_id` 关联（支持密码和 SSH 密钥）。
4. 支持连接测试与状态检测（在线/离线/未知）。
5. 支持批量导入/导出（CSV/JSON，后续可扩展）。
6. 支持轻量服务端状态查询（CPU、内存、磁盘、进程存活）。

### 5.4 中间件管理

#### 5.4.1 数据库类（database）

以 MySQL、PostgreSQL 为首批实现：

1. 通过 ExtConfig 存储连接信息。
2. 支持连接测试。
3. 数据库/表列表浏览。
4. SQL 执行（只读优先），支持限制语句类型。
5. 查询结果表格展示、导出（CSV）。

#### 5.4.2 缓存类（cache）

以 Redis 为首批实现：

1. 通过 ExtConfig 存储连接信息（含 Sentinel 模式支持）。
2. 支持常用命令查询（GET/HGETALL/SCAN 等），配置命令白名单。
3. 结果结构化展示。

#### 5.4.3 消息队列类（mq）

以 RocketMQ、RabbitMQ、Kafka 为首批实现：

1. 各 MQ 通过各自的插件 ExtConfig 存储连接信息。
2. 支持发送消息：Topic/Queue、Key、Headers、Body。
3. 提供消息模板与历史复用。
4. 可选回执/发送结果展示。

### 5.5 前端页面要求

1. 资产管理页面需支持按 `category` 和 `plugin_type` 动态渲染不同的配置表单。
2. 表单字段由插件的 `ConfigSchema` 驱动，新增插件无需修改前端页面代码。
3. 不同类别资产的操作入口差异化呈现：
   - 服务器：执行命令 / 打开终端
   - 数据库：SQL 查询
   - 缓存：命令查询
   - 消息队列：发送消息

### 5.6 快速操作中心

1. 在指定服务器执行单条命令。
2. 在指定服务器执行脚本文件（Bash）。
3. 支持单机执行与批量执行。
4. 支持预设脚本模板，参数化输入。
5. 执行结果实时输出、状态标记（成功/失败/超时）。
6. 高风险命令二次确认（`rm -rf`、`DROP` 等关键字策略）。
7. 集成在线终端（xterm.js + SSH PTY）：
   - 支持 SSH 交互式会话。
   - 支持终端会话连接、断开、重连与超时控制。
   - 支持终端操作审计。
8. 支持快捷操作面板（常用命令收藏、按环境复用模板、一键复制执行结果）。

### 5.7 域名与 DNS 服务

1. 可为每个资产维护一个或多个域名。
2. 工具内置 DNS 服务，支持 A 记录（优先），可扩展 CNAME/SRV。
3. 域名解析目标：服务器 IP、中间件 Host、逻辑服务地址。
4. 支持按环境隔离解析视图，避免不同环境同名冲突。
5. 支持 TTL 配置与本地缓存。
6. 支持 DNS 日志查看。

### 5.8 检索与视图

1. 全局搜索：按名称/IP/域名/标签/分组/插件类型。
2. 环境视图 + 分组树 + 列表联动。
3. 收藏与最近访问对象。

### 5.9 审计与日志

记录以下操作：登录/退出、命令执行、SQL 执行、Redis 命令执行、MQ 消息发送、配置变更。

支持按用户/时间/环境/操作类型筛选与导出。

### 5.10 配置备份与恢复

1. 支持整体配置导出（加密包）。
2. 支持从备份恢复。
3. 支持自动备份策略。

### 5.11 运行状态看板（轻量）

1. 按环境展示资产健康状态总览。
2. 支持最近检查时间、可用率趋势（近 24 小时）。
3. 支持异常对象高亮与快速跳转。
4. 支持轻量轮询健康检查（可配置间隔）并保留手动触发。

### 5.12 系统配置管理

1. 系统配置统一使用 YAML 文件管理。
2. 提供管理员可视化配置界面，支持表单化编辑。
3. 支持配置保存前校验。
4. 支持配置版本快照与回滚（轻量级）。
5. 敏感配置项默认脱敏并受权限控制。

---

## 6. 非功能需求

### 6.1 安全性

- 凭据加密存储（主密码派生密钥或系统密钥链）。
- 敏感字段脱敏展示。
- 支持操作权限控制（管理员/普通只读用户）。
- 高风险操作强提醒和审计留痕。

### 6.2 性能

- 资产规模目标：单环境 500+ 资产可流畅检索。
- 命令执行输出实时显示，首屏响应 < 1 秒（本地可达场景）。
- DNS 查询响应目标：本地网络下 p95 < 50ms。

### 6.3 可用性

- Windows 优先，兼容 macOS/Linux（后续评估）。
- 断网情况下可进行本地配置管理。

### 6.4 可扩展性

- 插件化中间件架构，新增插件类型无需修改核心代码。
- 插件注册表支持编译期或运行期注册（初期以编译期为主）。
- ExtConfig JSON 字段支持任意扩展，向后兼容旧版本数据。

---

## 7. 技术与架构约束

### 7.1 客户端架构

- 前端：React + TypeScript + shadcn/ui + Tailwind CSS。
- 桌面容器：Wails v2。
- 后端服务层：Go 1.24。

### 7.2 数据存储

- 本地元数据：SQLite（GORM）。
- 敏感凭据：AES-256-GCM 加密后落库。
- 操作日志：SQLite 分表。
- 系统配置：YAML 文件（支持可视化读写与版本快照）。

### 7.3 模块划分

| 模块 | 职责 |
|------|------|
| `asset` | 环境/分组/资产/凭据管理（含插件注册表） |
| `executor` | 命令与脚本执行 |
| `terminal` | 在线终端会话管理 |
| `connector` | 中间件连接抽象（插件化） |
| `dns` | DNS 解析与缓存 |
| `health` | 资产健康检查与状态聚合 |
| `config` | YAML 配置读写、校验与回滚 |
| `audit` | 审计日志 |
| `auth` | 登录与权限 |
| `plugin` | 插件注册表与 Schema 管理 |

---

## 8. 数据模型（目标状态）

### 8.1 Environment

```
id, name, code, description, color, enabled, sort_order, created_at, updated_at
```

### 8.2 Group

```
id, environment_id, name, description, sort_order, created_at, updated_at
```

### 8.3 Asset（重构后）

```
id, environment_id, group_id
category      -- 类别：server | database | cache | mq | other
plugin_type   -- 插件标识：linux_server | mysql | redis | rocketmq | ...
name, description
tags          -- JSON 数组
credential_id -- 可选，绑定凭据
status        -- unknown | online | offline | warning
last_checked_at
ext_config    -- JSON，存储类型专属配置
created_at, updated_at
```

> 不再有 `host`、`port` 独立列，全部进入 `ext_config`。

### 8.4 Credential

```
id, name
type          -- password | ssh_key | token
username
secret        -- AES-256-GCM 加密后的 base64
created_at, updated_at
```

### 8.5 ServiceDomain

```
id, environment_id, asset_id, domain, record_type, target, ttl, enabled
```

### 8.6 AuditLog

```
id, operator
action_type   -- ssh_cmd | sql | redis | mq | config_change | credential_view
resource_type, resource_id, resource_name
detail        -- JSON，操作内容
result        -- success | failure
created_at
```

### 8.7 HealthSnapshot

```
id, asset_id, checked_at
ping_ms, tcp_ok
cpu_percent, mem_percent, disk_percent
status        -- healthy | warning | critical | unreachable
raw_data      -- JSON，原始采集数据
```

### 8.8 DNSRecord

```
id, environment_id, asset_id, domain, record_type, value, ttl, enabled
```

### 8.9 ConfigSnapshot

```
id, version, content（YAML 全文）, comment, created_at, created_by
```

### 8.10 Execution

```
id, asset_id, asset_name, asset_host
command, output, exit_code
status        -- running | success | failed | interrupted
operator, started_at, finished_at, created_at
```

---

## 9. 交互与页面（MVP）

1. 管理员登录页（普通只读用户免登录）。
2. 环境总览页（环境卡片 + 资产统计）。
3. 资产管理页：
   - 资产列表（支持按 category/plugin_type 筛选）
   - **动态表单**：根据 plugin_type 加载对应 ConfigSchema 渲染不同的配置字段
   - 凭据管理
4. 快速操作页（命令执行 + 在线终端 + 历史记录）。
5. 数据查询页（数据库/缓存查询）。
6. MQ 发送页。
7. DNS 管理页（域名映射 + 查询日志）。
8. 运行状态页（健康看板）。
9. 系统配置页。
10. 审计页。

---

## 10. 里程碑建议

### M1（MVP）

- 资产管理重构（新数据模型 + 插件注册表 + 动态表单）
- 服务器命令执行（单机/批量）
- 在线终端（Linux SSH）
- MySQL/PostgreSQL 查询（只读）
- Redis 常用查询
- MQ 发送（RocketMQ、RabbitMQ、Kafka）
- 轻量轮询健康检查与状态看板
- 域名映射 + DNS A 记录解析
- 审计基础能力
- 管理员登录 + 普通只读免登录浏览
- YAML 配置管理 + 可视化配置页

### M2（增强）

- 批量执行与脚本模板
- 高风险策略引擎
- 备份恢复
- DNS 高级记录与冲突检测
- 更多数据库插件（MongoDB、ClickHouse 等）

### M3（扩展）

- 外部插件加载机制
- 团队协作能力（多用户、多端同步）
- 远程代理与复杂网络拓扑支持

---

## 11. 验收标准（MVP）

1. 可创建至少 3 个环境并分组管理 100+ 资产。
2. 可对目标服务器执行命令并获取结果。
3. 可通过在线终端与目标服务器进行交互式会话。
4. 可执行 MySQL/PostgreSQL 只读 SQL 并展示结果。
5. 可执行 Redis 常用命令查询。
6. 可向 RocketMQ、RabbitMQ、Kafka 成功发送消息。
7. 域名可被内置 DNS 成功解析到目标。
8. 可在状态看板查看资产健康状态并识别异常对象。
9. 管理员可执行写操作，普通只读用户在开关开启时可免登录查看但不可修改。
10. 所有关键操作可在审计页面查询。
11. 新增资产时，根据 plugin_type 自动显示对应的配置表单字段。
12. 增加新插件类型（如 MongoDB）只需注册插件配置，无需修改核心资产管理代码。

---

## 12. 风险

- 不同中间件协议差异大，统一插件抽象可能牺牲部分高级特性，需在 ExtConfig 扩展。
- ExtConfig JSON 字段在大量资产下的查询性能（条件查询），需通过应用层过滤补偿或为常用字段增加虚拟列索引。
- 内置 DNS 与本机网络配置可能存在权限或端口占用问题。
- 高风险操作防护规则需要持续调优。
- 数据库重构需要对已有数据进行迁移，需提供平滑迁移方案。

---

## 13. 附录：MoSCoW 优先级

| 级别 | 内容 |
|------|------|
| Must | 资产管理（新模型+插件化）、凭据加密、命令执行、Linux 在线终端、MySQL/PostgreSQL/Redis/RocketMQ/RabbitMQ/Kafka 连接、DNS 映射解析、健康看板、审计日志、管理员/只读双角色、YAML 配置 |
| Should | 批量执行、脚本模板、高风险策略、备份恢复、PostgreSQL/Kafka 支持 |
| Could | 外部插件加载、跨端同步、复杂网络拓扑支持、更多数据库类型 |
| Won't（当前阶段） | 替代堡垒机、完整发布流水线 |

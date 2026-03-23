# EnvPilot

> 多环境运维管理工具 — 支持桌面客户端与服务端两种部署模式

EnvPilot 是一个 DevOps 运维助手，用于统一管理服务器和中间件资产。  
采用插件化资产模型，支持 SSH 命令执行、在线终端、健康检查等运维功能。

---

## 部署模式

| 模式 | 适用场景 | 通信方式 |
|------|---------|---------|
| **桌面模式**（Wails） | 本地个人使用，无需服务器 | Wails IPC（原生 WebView 桥接） |
| **服务端模式**（HTTP） | 团队共享，部署到服务器 | REST API + SSE + WebSocket |

两种模式共享全部业务逻辑（`internal/`），只有入口层不同。

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 桌面容器 | Wails v2（Go + WebView2） |
| 后端语言 | Go 1.25 |
| HTTP 框架 | Go 标准库 `net/http`（1.22+ 路径参数语法） |
| 前端框架 | React 18 + TypeScript |
| 样式系统 | TailwindCSS v4 + shadcn/ui |
| 状态管理 | Zustand |
| 本地数据库 | SQLite（GORM） |
| 日志系统 | zap + lumberjack |
| 实时通信 | Wails IPC（桌面）/ SSE + WebSocket（服务端） |

---

## 核心功能

- **资产管理**：环境 / 分组 / 资产 / 凭据 CRUD，插件化资产类型（8 种内置）
- **命令执行**：SSH 单机执行、批量并发执行，实时输出流式推送
- **在线终端**：SSH PTY 全功能终端，基于 xterm.js
- **中间件连接**：MySQL / PostgreSQL / Redis / RocketMQ / RabbitMQ / Kafka，已支持连接测试、库表浏览、只读 SQL、Redis 命令和 MQ 消息发送
- **健康检查**：定时 Ping / TCP / 资源监控（待实现）
- **操作审计**：已支持资产、凭据、连接器操作日志记录与统一查询，审计页面已可用

---

## 快速开始

### 开发环境要求

- Go 1.25+
- Node.js 20+
- Wails CLI v2（桌面模式需要）

```bash
# 安装 Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### 桌面模式开发

```bash
# 启动热更新开发模式
wails dev

# 或使用 Makefile
make dev
```

### 服务端模式开发

```bash
# 终端 1：启动 Go HTTP 服务
make dev-server
# 等同于：go run ./cmd/server/ --addr :8080

# 终端 2：启动前端开发服务器（含代理）
npm run dev:server --prefix frontend
# 访问：http://localhost:5173
```

---

## 构建

```bash
# 桌面版（Wails，当前平台）
make build-desktop

# 直接使用 wails build 也会在构建前自动同步版本号和 commitid
wails build

# 服务端版（HTTP，当前平台）
make build-server
./bin/envpilot-server --addr :8080

# 交叉编译服务端（Linux amd64）
make build-server-linux

# 同时构建两种模式
make build-all
```

> 服务端版前端以静态资源形式内嵌到二进制文件，无需单独部署 Web 服务器。
>
> 构建元信息说明：`make build-*`、GitHub Release 工作流以及直接执行 `wails build` 都会先运行 `go run ./cmd/buildmeta -mode sync`，统一生成应用内版本号、短 commitid 以及桌面端包资源版本。未命中 Git tag 时版本号默认为 `dev`，桌面包资源版本回落为 `0.0.0`。

## 配置示例

`config/config.yaml` 中的数据库配置已按驱动拆分，避免 SQLite 和 MySQL 字段混用。当前推荐默认使用 SQLite，本地即可启动：

```yaml
app:
  name: EnvPilot
  data_dir: ./data
  log_dir: ./logs

database:
  driver: sqlite
  sqlite:
    filename: envpilot.db
  mysql:
    host: 127.0.0.1
    port: 3306
    username: root
    password: ""
    dbname: envpilot
    params: charset=utf8mb4&parseTime=True&loc=UTC
  pool:
    max_idle_conns: 5
    max_open_conns: 20
```

说明：

- `database.driver=sqlite` 时只使用 `database.sqlite.*`
- `database.driver=mysql` 时只使用 `database.mysql.*`
- `database.pool.*` 为通用连接池参数
- 旧版平铺结构 `database.host / database.filename / ...` 仍可读取，但保存后会统一写回新结构

## CI / Release

- `main` / `master` 分支提交或合并请求会触发 GitHub Actions 构建校验；测试阶段默认执行 `make test-core`，只覆盖 `internal/`、`database/`、`pkg/` 下的业务与基础包。桌面链路在分支校验中只执行前端资源构建和 `go build .` 入口编译，不执行应用启动测试，避免因本地数据库配置指向外部 MySQL 导致校验失败
- 推送 `v` 开头的 tag（例如 `v0.0.1`）会触发 Release 工作流；同样会先执行 `make test-core`，然后再构建 Linux 服务端包（amd64、arm64，基于纯 Go SQLite 驱动使用 `CGO_ENABLED=0` 构建，避免额外的 GLIBC/Zig 依赖）、macOS 通用桌面包（Intel + Apple Silicon）和 Windows 桌面包（amd64、arm64）并发布到 GitHub Releases
- 本地可使用 `./scripts/release.sh v0.0.1` 自动切换到发布分支、同步远端、创建 annotated tag 并推送到远端；脚本会优先使用 `master`，不存在时回落到远端默认分支

---

## 文档

所有文档位于 `doc/` 目录：

| 文档 | 说明 |
|------|------|
| [`doc/req.md`](doc/req.md) | 需求规格说明书（v0.2） |
| [`doc/design.md`](doc/design.md) | 系统技术设计文档（架构、数据模型、API、开发规范） |
| [`doc/dev.md`](doc/dev.md) | 开发进度与阶段任务文档 |
| [`doc/modules.md`](doc/modules.md) | 模块文档导航页 |
| [`doc/modules-foundation.md`](doc/modules-foundation.md) | 基础设施模块说明 |
| [`doc/modules-business.md`](doc/modules-business.md) | 业务模块说明 |

---

## 插件化架构

EnvPilot 目前将服务器与中间件都建模为插件。每个内置插件集中在 `internal/plugin/builtin/<type>/` 目录，通常按以下方式拆分：

- `definition.go`：插件元数据定义与注册
- `connector.go`：连接器工厂注册与具体实现

插件元数据统一通过 `PluginDef` 描述：

- `config_schema`：前端动态表单字段
- `credential_types`：允许绑定的凭据类型
- `credential_required`：是否要求强制绑定凭据
- `capabilities`：该插件支持的连接或执行能力
- `integration_guide`：后续扩展该类中间件时的接入要点

这意味着新增一个中间件时，不需要在前端、连接器、资产管理各自维护一份元数据；同时目录内又保留了定义与运行逻辑的职责拆分，避免单文件膨胀。

### 当前内置中间件能力

| 类型 | 分类 | 主要能力 | 典型凭据 |
|------|------|------|------|
| MySQL | database | 连接测试 / 库表浏览 / 只读 SQL | password |
| PostgreSQL | database | 连接测试 / 库表浏览 / 只读 SQL | password |
| Redis | cache | 连接测试 / 白名单命令执行 | password, token |
| RabbitMQ | mq | 连接测试 / 消息发送 | password |
| Kafka | mq | 连接测试 / 消息发送 | password, token, sasl |
| RocketMQ | mq | 连接测试 / 消息发送 | token, access_key_secret |

---

## 凭据体系

为了适配不同中间件，凭据类型已经从单一密码模式扩展为以下几类：

- `password`：用户名 + 密码，适用于 MySQL、PostgreSQL、RabbitMQ 等
- `ssh_key`：SSH 私钥，适用于 Linux 服务器
- `token`：单值 Token 或访问口令，适用于 Redis、RocketMQ 等
- `access_key_secret`：AccessKey + SecretKey，适用于 RocketMQ ACL 等场景
- `sasl`：SASL 用户名 + 密钥，适用于 Kafka SASL 认证

资产绑定凭据时会按插件定义做兼容性校验，前端也会自动过滤不兼容凭据，减少配置错误。

---

## 审计覆盖

当前已经接入的审计内容包括：

- 资产创建、更新、删除
- 凭据创建、更新、删除、明文查看
- 连接器连接测试
- SQL 执行、Redis 命令执行、MQ 消息发送

当前仍在补充的增强项包括：

- 更细粒度筛选条件
- 审计日志导出
- executor 等剩余链路的进一步覆盖

审计日志支持桌面模式和服务端模式统一查询，前端页面位于 `操作审计`。

---

## 项目结构

```
EnvPilot/
├── main.go                  # 桌面模式入口（Wails）
├── app.go                   # Wails 生命周期 + 基础 API（桌面专用）
├── Makefile                 # 构建脚本
│
├── cmd/
│   └── server/
│       ├── main.go          # 服务端模式入口（HTTP）
│       ├── embed.go         # 前端静态资源内嵌
│       └── dist/            # 服务端前端构建产物（make build-server 生成）
│
├── api/                     # 服务端 HTTP handler 层
│   ├── router.go            # 路由注册 + CORS + SPA fallback
│   ├── asset_handler.go     # 资产管理 REST handler
│   ├── executor_handler.go  # 命令执行（POST）+ 输出流（SSE）+ 终端（WebSocket）
│   ├── event_bus.go         # 进程内发布订阅总线（服务端实时事件）
│   └── util.go              # JSON 响应工具
│
├── internal/                # 共享业务逻辑（桌面 / 服务端均使用）
│   ├── app/
│   │   └── container.go     # 共享初始化容器（无 Wails 依赖）
│   ├── plugin/              # 插件注册表（资产类型定义）
│   │   ├── definition.go    # PluginDef、ConfigField 结构
│   │   ├── registry.go      # Register / Get / List
│   │   └── builtin/         # 8 种内置插件目录（按 <type>/definition.go + connector.go 组织）
│   ├── asset/               # 资产管理（环境/分组/资产/凭据）
│   │   ├── api/             # Wails 绑定层（桌面专用）
│   │   ├── model/           # 数据模型（Asset / Credential / Environment / Group）
│   │   ├── repository/      # 数据访问层
│   │   └── service/         # 业务逻辑层
│   ├── executor/            # SSH 命令执行 + 在线终端
│   │   ├── api/             # Wails 绑定层（含 WailsEmitter）
│   │   ├── model/           # 执行记录模型
│   │   ├── repository/      # 执行记录持久化
│   │   ├── service/         # 执行服务（依赖 event.Emitter 接口）
│   │   └── ssh/             # SSH 连接池 + 危险命令检测
│   ├── connector/           # 中间件连接器抽象、工厂、服务与双模式 API
│   ├── audit/               # 审计模型、Repository、Service 与查询 API
│   └── config/              # 系统配置
│
├── pkg/                     # 公共工具包
│   ├── crypto/              # AES-256-GCM 加解密 + PBKDF2
│   ├── event/               # EventEmitter 接口（桌面/服务端解耦）
│   └── logger/              # 全局日志（zap）
│
├── database/                # 数据库连接与迁移
│   ├── db.go
│   └── migration/           # 版本化迁移（schema_migrations 表追踪）
│
├── config/                  # 配置文件（YAML）
│
├── frontend/                # React 18 前端（shadcn/ui + TypeScript）
│   ├── src/
│   │   ├── lib/
│   │   │   ├── apiClient.ts     # HTTP / WebSocket / SSE 封装（服务端模式）
│   │   │   └── wailsRuntime.ts  # Wails 事件安全封装（桌面模式）
│   │   ├── services/            # 后端调用封装（双模式自动切换）
│   │   ├── store/               # Zustand 状态管理
│   │   ├── pages/               # 页面组件
│   │   └── components/          # 公共组件（shadcn/ui）
│   ├── dist/                    # 桌面模式构建产物（Wails 内嵌）
│   ├── dist-server/             # 服务端模式构建产物
│   └── vite.config.ts           # 支持 desktop / server 双模式构建
│
└── doc/                     # 项目文档
```

---

## 安全说明

- 所有敏感数据（密码、私钥）使用 AES-256-GCM 加密存储
- 密钥通过 PBKDF2-SHA256 从主密码派生
- 高风险命令（`rm -rf` / `DROP` / `DELETE`）需要二次确认
- 明文凭据查看操作将记录审计日志
- 服务端模式 CORS 默认允许所有来源（生产部署时请按需收紧）

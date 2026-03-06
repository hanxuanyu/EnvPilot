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
| 后端语言 | Go 1.23 |
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
- **中间件连接**：MySQL / PostgreSQL / Redis / RocketMQ / RabbitMQ / Kafka（待实现）
- **健康检查**：定时 Ping / TCP / 资源监控（待实现）
- **操作审计**：全量操作日志（待实现）

---

## 快速开始

### 开发环境要求

- Go 1.22+
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

# 服务端版（HTTP，当前平台）
make build-server
./bin/envpilot-server --addr :8080

# 交叉编译服务端（Linux amd64）
make build-server-linux

# 同时构建两种模式
make build-all
```

> 服务端版前端以静态资源形式内嵌到二进制文件，无需单独部署 Web 服务器。

---

## 文档

所有文档位于 `doc/` 目录：

| 文档 | 说明 |
|------|------|
| [`doc/req.md`](doc/req.md) | 需求规格说明书（v0.2） |
| [`doc/design.md`](doc/design.md) | 系统技术设计文档（架构、数据模型、API、开发规范） |
| [`doc/dev.md`](doc/dev.md) | 开发进度与阶段任务文档 |

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
│   │   └── builtin/         # 8 种内置插件（linux_server / mysql / redis 等）
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

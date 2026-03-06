# EnvPilot

> 桌面端多环境运维管理工具

EnvPilot 是一个本地运行的 DevOps 运维助手，用于统一管理服务器和中间件资源。

## 技术栈

| 层次 | 技术 |
|------|------|
| 桌面容器 | Wails v2（Go + WebView2） |
| 后端语言 | Go 1.24 |
| 前端框架 | React 18 + TypeScript |
| 样式系统 | TailwindCSS v4 |
| 本地数据库 | SQLite（GORM） |
| 日志系统 | zap + lumberjack |

## 核心功能

- **服务器管理**：SSH 命令执行、批量脚本、在线 Terminal
- **中间件连接**：MySQL 查询、Redis 命令、MQ 消息发送
- **资产管理**：环境/分组/资产/凭据 CRUD
- **DNS 服务**：内置 DNS 服务器，环境隔离解析
- **健康检查**：定时 Ping/TCP/资源监控
- **操作审计**：全量操作日志记录

## 开发环境要求

- Go 1.22+
- Node.js 20+
- Wails CLI v2

```bash
# 安装 Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

## 启动开发模式

```bash
wails dev
```

## 构建发行版

```bash
wails build
```

## 文档

所有文档均位于 `doc/` 目录：

| 文档 | 说明 |
|------|------|
| `doc/req.md` | 需求规格说明书（v0.2） |
| `doc/design.md` | 系统技术设计文档（架构、数据模型、API、开发规范） |
| `doc/dev.md` | 开发进度与阶段任务文档 |

## 项目结构

```
EnvPilot/
├── main.go              # 程序入口
├── app.go               # Wails 应用绑定（组合根）
├── internal/            # 业务模块
│   ├── plugin/          # 插件注册表（资产类型定义）
│   ├── asset/           # 资产管理（环境/分组/资产/凭据）
│   ├── executor/        # SSH 命令执行
│   ├── terminal/        # 在线终端（PTY）
│   ├── connector/       # 中间件连接器（插件化）
│   ├── dns/             # DNS 服务
│   ├── health/          # 健康检查
│   ├── audit/           # 操作审计
│   ├── config/          # 系统配置
│   └── auth/            # 认证
├── pkg/                 # 公共工具包
│   ├── crypto/          # AES-256 加解密
│   └── logger/          # 全局日志
├── database/            # 数据库连接与迁移
├── config/              # 配置文件（YAML）
├── doc/                 # 项目文档
│   ├── req.md           # 需求文档
│   ├── design.md        # 技术设计文档
│   └── dev.md           # 开发进度文档
└── frontend/            # React 前端（React 18 + shadcn/ui）
```

## 安全说明

- 所有敏感数据（密码、私钥、密钥）使用 AES-256-GCM 加密存储
- 密钥通过 PBKDF2-SHA256 从主密码派生
- 高风险命令（rm -rf / DROP / DELETE）需要二次确认
- 所有操作记录审计日志

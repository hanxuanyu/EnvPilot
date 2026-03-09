# EnvPilot 基础设施模块说明

本文档说明平台基础设施、通用能力和构建资源相关模块，聚焦跨业务复用的底层职责。

---

## 基础设施模块

### `pkg/logger`

日志工具包，负责统一日志输出能力：

- 基于 zap 提供结构化日志
- 同时支持控制台和文件输出
- 支持日志滚动与级别配置

### `pkg/crypto`

加密工具包，供需要加密存储的模块复用：

- AES-256-GCM 加解密
- PBKDF2 密钥派生
- 主要服务于凭据与敏感配置场景

### `database`

数据库层负责：

- SQLite 连接初始化
- WAL 模式配置
- 统一执行 GORM 迁移
- 为所有模块共享同一 DB 实例

### `internal/config`

系统配置模块当前负责：

- YAML 配置文件加载与保存
- 默认值填充与字段校验
- 配置快照持久化与版本管理
- 配置回滚与当前配置读取
- 配置管理页面所需的双模式接口支撑

当前已落地能力：

- `008_config` 迁移已创建 `config_snapshots` 表
- 保存配置时自动生成新快照，并记录备注与操作人
- 支持读取当前配置、查询版本列表、查看快照详情、回滚到历史版本
- 配置修改与回滚已接入审计日志
- 构建版本改由 Git tag / commit 注入，不再通过配置文件维护 `app.version`
- 已接入运行时配置应用器，可在线更新日志、DNS、健康检查调度、危险命令规则与数据库连接池

---

## 构建资源目录

### `build`

`build/` 目录用于放置桌面构建所需的平台资源文件。

目录说明：

- `bin/`：构建输出目录
- `darwin/`：macOS 平台构建资源
- `windows/`：Windows 平台构建资源与安装器配置

其中：

- `darwin/Info.plist`：Wails 构建时使用的 macOS plist
- `darwin/Info.dev.plist`：Wails 开发模式使用的 macOS plist
- `windows/info.json`：Windows 应用与安装器元数据
- `windows/wails.exe.manifest`：Windows 应用 manifest
- `windows/installer/`：Windows 安装器相关配置

如果需要恢复为 Wails 默认生成内容，可删除相应平台文件后重新执行构建。

---

## 适用场景

当你需要处理以下问题时，优先参考本页：

- 日志与错误排查
- 加密与敏感数据存储
- 数据库初始化与迁移
- 配置加载与配置生命周期
- 桌面打包资源与平台构建定制
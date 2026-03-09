# EnvPilot 业务模块说明

本文档说明业务模块、规划模块以及模块边界，聚焦资产、执行、中间件、审计等核心业务能力。

---

## 已落地业务模块

### `internal/asset`

资产管理模块负责：

- 环境、分组、资产、凭据 CRUD
- 插件化资产类型管理
- 资产搜索与标签能力
- 凭据脱敏展示与兼容性校验

目录职责：

- `model/`：Environment、Group、Asset、Credential 等模型
- `repository/`：GORM 数据访问
- `service/`：业务校验、插件校验、加解密、审计注入
- `api/`：Wails 绑定接口

### `internal/executor`

命令执行模块负责：

- SSH 单条命令执行
- 批量命令执行与结果记录
- 在线终端相关支撑能力
- 风险命令检测和执行日志持久化

目录职责：

- `model/`：执行记录模型
- `repository/`：执行记录查询与写入
- `service/`：命令执行、终端会话管理
- `ssh/`：连接池、SSH 相关工具与限制
- `api/`：Wails 绑定接口

### `internal/connector`

中间件连接器模块负责统一接入数据库、缓存、消息队列类资产：

- MySQL、PostgreSQL 查询
- Redis 命令执行
- RabbitMQ、Kafka、RocketMQ 消息发送
- 统一连接测试和资源释放接口

当前能力：

- `DatabaseConnector`：MySQL、PostgreSQL
- `CacheConnector`：Redis
- `MQConnector`：RabbitMQ、Kafka、RocketMQ

目录职责：

- `connector.go`：核心接口与通用 DTO
- `factory.go`：工厂注册表
- `sql.go`：SQL 结果扫描与通用转换
- `service/`：资产解析、安全限制、能力调度
- `api/`：Wails 绑定接口

内置中间件的具体实现集中在 `internal/plugin/builtin/<plugin_type>/`：

- `definition.go`：插件元数据定义与注册
- `connector.go`：连接器工厂注册与具体逻辑

#### 新中间件接入流程

1. 在 `internal/plugin/builtin/<plugin_type>/definition.go` 中定义插件 Schema。
2. 根据能力实现 `DatabaseConnector`、`CacheConnector` 或 `MQConnector`。
3. 在 `internal/plugin/builtin/<plugin_type>/connector.go` 中完成连接器实现。
4. 在实现包的 `init()` 中调用 `connector.RegisterFactory(...)`。
5. 在 `internal/connector/service/connector_service.go` 中接入业务编排与安全限制。
6. 同时暴露 Wails API 和 HTTP API。
7. 为前端补充独立 panel，而不是堆进单一组件。
8. 完成 `go build ./...` 与前端构建验证。

当前已有的安全限制：

- SQL 只读语句校验
- Redis 命令白名单
- MQ 消息摘要记录与统一 DTO 适配

### `internal/audit`

操作审计模块负责记录关键管理动作和连接器行为，并提供统一查询能力。

当前覆盖范围：

- 资产：创建、更新、删除
- 凭据：创建、更新、删除、明文查看
- 连接器：连接测试、SQL 执行、Redis 命令执行、MQ 消息发送

目录职责：

- `model/`：审计日志模型
- `repository/`：审计写入与查询
- `service/`：记录封装、BestEffort 写入、分页查询
- `api/`：Wails 绑定接口

审计记录约束：

- 优先记录请求摘要和结果摘要，而不是直接持久化敏感明文
- MQ 消息当前只记录主题、路由键、Header 数量和消息体长度，不直接保存完整消息体
- 后续扩展到 executor、config、health 时，优先沿用同一个 `AuditService`

---

## 规划中业务模块

### `internal/dns`

DNS 服务模块的目标能力：

- 内置轻量 DNS 服务
- A 记录解析
- 环境隔离
- TTL 配置
- 查询日志

### `internal/health`

健康检查模块的目标能力：

- Ping / TCP / 资源指标检查
- 健康快照存储
- 聚合状态计算
- 健康看板展示

### `internal/auth`

认证模块的目标能力：

- 本地主密码认证
- 密钥派生
- 高风险操作二次确认

### `internal/terminal`

该目录当前更像历史预留位。在线终端实际能力主要由 `internal/executor` 和前端终端页面承接，后续可根据需要继续合并或清理。

---

## 适用场景

当你需要处理以下问题时，优先参考本页：

- 资产和凭据边界
- SSH 执行与终端能力
- 中间件连接器接入与扩展
- 审计覆盖范围和摘要记录策略
- DNS、健康检查、认证等后续模块规划
# connector

中间件连接器模块：提供 MySQL/PostgreSQL 查询、Redis 命令执行、RabbitMQ/Kafka/RocketMQ 消息发送的统一连接器接口。所有连接器都需要支持连接测试和资源释放。

## 当前能力

- DatabaseConnector: MySQL、PostgreSQL
- CacheConnector: Redis
- MQConnector: RabbitMQ、Kafka、RocketMQ

## 目录结构

- `connector.go` - 核心接口与通用 DTO
- `factory.go` - 连接器工厂注册表
- `sql.go` - SQL 结果扫描与通用转换
- `service/` - 业务编排与安全限制
- `api/` - Wails 绑定层

内置中间件的具体实现不再放在 `impl/` 下，而是集中在 `internal/plugin/builtin/<plugin_type>/` 目录中：

- `definition.go` - 插件元数据定义与注册
- `connector.go` - 连接器工厂注册与具体连接逻辑

## 新中间件接入流程

新增一个中间件时，尽量按下面顺序落地，这样可以保证桌面模式和服务端模式同时可用。

### 1. 先定义插件 Schema

在 `internal/plugin/builtin/<plugin_type>/definition.go` 中新增或扩展插件定义，明确：

- `type_id`
- `category`
- `config_schema`
- `credential_types`
- `capabilities`
- `integration_guide`

这一步决定资产录入时 `ext_config` 的结构，也是连接器运行时解析配置的基础。

### 2. 选择能力接口

根据中间件能力实现以下接口之一：

- `DatabaseConnector`
- `CacheConnector`
- `MQConnector`

如果现有接口无法表达能力，先在 `connector.go` 中补充通用 DTO，再实现具体连接器，避免把某个中间件特有字段硬编码在 service 层。

### 3. 实现连接器

在 `internal/plugin/builtin/<plugin_type>/connector.go` 下新增实现，通常包含：

- 从 `asset.ext_config` 解析连接参数
- 从 `credential` 解析密钥或用户名密码
- `Connect / Ping / Close`
- 核心操作方法，例如 `Execute`、`Command`、`SendMessage`

建议同时处理：

- TLS / SASL / Sentinel 等可选连接模式
- 连接复用
- 超时与资源释放
- 统一错误信息

### 4. 注册工厂

在连接器实现包的 `init()` 中调用 `connector.RegisterFactory(...)`。对于内置插件，只需要保证 `internal/plugin/builtin/imports.go` 聚合导入了对应目录，应用启动时就会完成注册。

### 5. 接入业务层

在 `internal/connector/service/connector_service.go` 中：

- 解析资产与凭据
- 选择对应 connector 接口
- 增加必要的安全限制

当前已有的限制模式：

- SQL 只读语句校验
- Redis 命令白名单
- MQ 消息统一 DTO 适配

### 6. 暴露双模式 API

每个新增能力都需要同时暴露：

- Wails API：`internal/connector/api/connector_api.go`
- HTTP API：`api/connector_handler.go` 和 `api/router.go`

这样桌面端和服务端可以复用同一套前端页面。

### 7. 补前端独立面板

不要把所有中间件逻辑堆在一个组件里。推荐做法是：

- 页面只负责分类和资产选择
- 每种中间件一个独立 panel
- 共性逻辑沉到 `frontend/src/components/connector/` 公共组件和工具函数

当前实现参考：

- SQLConnectorPanel
- RedisConnectorPanel
- RabbitMQConnectorPanel
- KafkaConnectorPanel
- RocketMQConnectorPanel

### 8. 最后做编译验证

至少执行：

- `go mod tidy && go build ./...`
- `cd frontend && npm run build`

如果是新增依赖，优先确认 `go.mod` / `go.sum` 已写入，再继续排查编译问题。


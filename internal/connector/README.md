# connector

中间件连接器模块：提供 MySQL 查询、Redis 命令执行、MQ 消息发送的统一连接器接口。所有连接支持测试 Ping。

## 目录结构

- `model/` - 数据模型定义
- `repository/` - 数据访问层（GORM）
- `service/` - 业务逻辑
- `api/` - 对前端暴露的接口（Wails 绑定）


# database

数据库层：SQLite 连接初始化（WAL 模式）和数据库迁移管理。所有模块共享同一 GORM DB 实例。

## 目录结构

- `model/` - 数据模型定义
- `repository/` - 数据访问层（GORM）
- `service/` - 业务逻辑
- `api/` - 对前端暴露的接口（Wails 绑定）


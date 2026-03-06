# health

健康检查模块：定时对资产执行 Ping/TCP/资源指标检查，存储快照数据，提供健康状态看板。

## 目录结构

- `model/` - 数据模型定义
- `repository/` - 数据访问层（GORM）
- `service/` - 业务逻辑
- `api/` - 对前端暴露的接口（Wails 绑定）


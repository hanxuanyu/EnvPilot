# dns

DNS 服务模块：内置轻量 DNS 服务器，支持 A 记录解析、环境隔离、TTL 配置和查询日志。

## 目录结构

- `model/` - 数据模型定义
- `repository/` - 数据访问层（GORM）
- `service/` - 业务逻辑
- `api/` - 对前端暴露的接口（Wails 绑定）


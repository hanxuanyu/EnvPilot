# audit

操作审计模块：记录所有关键操作（命令执行/SQL/Redis/MQ/配置变更），提供审计日志查询接口。

## 目录结构

- `model/` - 数据模型定义
- `repository/` - 数据访问层（GORM）
- `service/` - 业务逻辑
- `api/` - 对前端暴露的接口（Wails 绑定）


# executor

命令执行模块：通过 SSH 在远程服务器上执行命令。支持单条命令执行、批量脚本执行，记录完整执行日志。

## 目录结构

- `model/` - 数据模型定义
- `repository/` - 数据访问层（GORM）
- `service/` - 业务逻辑
- `api/` - 对前端暴露的接口（Wails 绑定）


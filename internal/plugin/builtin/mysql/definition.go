package mysql

import (
	"EnvPilot/internal/plugin"
)

func init() {
	plugin.Register(&plugin.PluginDef{
		TypeID:             "mysql",
		DisplayName:        "MySQL",
		Category:           plugin.CategoryDatabase,
		IconName:           "database",
		CredentialRequired: true,
		CredentialTypes: []plugin.CredentialKind{
			plugin.CredentialKindPassword,
		},
		Capabilities: []plugin.Capability{
			plugin.CapabilityTestConnection,
			plugin.CapabilityListDatabases,
			plugin.CapabilityListTables,
			plugin.CapabilityExecuteSQL,
		},
		IntegrationGuide: []string{
			"实现 DatabaseConnector 并注册 connector factory",
			"补充 SQL 只读限制和前端独立 panel",
		},
		ConfigSchema: []plugin.ConfigField{
			{Key: "host", Label: "主机地址", Type: plugin.FieldTypeText, Required: true, Placeholder: "db.example.com"},
			{Key: "port", Label: "端口", Type: plugin.FieldTypeNumber, Required: true, DefaultVal: 3306},
			{Key: "database", Label: "数据库名", Type: plugin.FieldTypeText, Required: false, Placeholder: "app_db（可选，连接后可切换）"},
			{Key: "extra_params", Label: "额外连接参数", Type: plugin.FieldTypeText, Required: false, Placeholder: "charset=utf8mb4&parseTime=true", Description: "追加到 DSN 末尾的参数"},
			{Key: "ssl_mode", Label: "SSL 模式", Type: plugin.FieldTypeSelect, Required: false, DefaultVal: "disable", Options: []plugin.SelectOption{{Value: "disable", Label: "禁用"}, {Value: "require", Label: "要求"}, {Value: "verify-ca", Label: "验证 CA"}}},
		},
	})
}

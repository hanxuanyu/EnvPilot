package builtin

import "EnvPilot/internal/plugin"

func init() {
	plugin.Register(&plugin.PluginDef{
		TypeID:      "postgresql",
		DisplayName: "PostgreSQL",
		Category:    plugin.CategoryDatabase,
		IconName:    "database",
		ConfigSchema: []plugin.ConfigField{
			{
				Key: "host", Label: "主机地址", Type: plugin.FieldTypeText,
				Required: true, Placeholder: "pg.example.com",
			},
			{
				Key: "port", Label: "端口", Type: plugin.FieldTypeNumber,
				Required: true, DefaultVal: 5432,
			},
			{
				Key: "database", Label: "数据库名", Type: plugin.FieldTypeText,
				Required: false, Placeholder: "postgres",
			},
			{
				Key: "schema", Label: "Schema", Type: plugin.FieldTypeText,
				Required: false, DefaultVal: "public", Placeholder: "public",
			},
			{
				Key: "ssl_mode", Label: "SSL 模式", Type: plugin.FieldTypeSelect,
				Required: false, DefaultVal: "disable",
				Options: []plugin.SelectOption{
					{Value: "disable", Label: "禁用"},
					{Value: "require", Label: "要求"},
					{Value: "verify-full", Label: "完整验证"},
				},
			},
		},
	})
}

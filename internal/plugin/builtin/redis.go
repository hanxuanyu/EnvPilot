package builtin

import "EnvPilot/internal/plugin"

func init() {
	plugin.Register(&plugin.PluginDef{
		TypeID:      "redis",
		DisplayName: "Redis",
		Category:    plugin.CategoryCache,
		IconName:    "zap",
		ConfigSchema: []plugin.ConfigField{
			{
				Key: "host", Label: "主机地址", Type: plugin.FieldTypeText,
				Required: true, Placeholder: "cache.example.com",
			},
			{
				Key: "port", Label: "端口", Type: plugin.FieldTypeNumber,
				Required: true, DefaultVal: 6379,
			},
			{
				Key: "db", Label: "DB 序号", Type: plugin.FieldTypeNumber,
				Required: false, DefaultVal: 0, Placeholder: "0",
			},
			{
				Key: "tls", Label: "启用 TLS", Type: plugin.FieldTypeBoolean,
				Required: false, DefaultVal: false,
			},
			{
				Key: "sentinel_addrs", Label: "Sentinel 地址", Type: plugin.FieldTypeText,
				Required: false, Placeholder: "sentinel1:26379,sentinel2:26379",
				Description: "Sentinel 模式下填写，多个地址用逗号分隔",
			},
			{
				Key: "master_name", Label: "Master 名称", Type: plugin.FieldTypeText,
				Required: false, Placeholder: "mymaster",
				Description: "Sentinel 模式下的 master 名称",
			},
		},
	})
}

package builtin

import "EnvPilot/internal/plugin"

func init() {
	plugin.Register(&plugin.PluginDef{
		TypeID:      "linux_server",
		DisplayName: "Linux 服务器",
		Category:    plugin.CategoryServer,
		IconName:    "server",
		ConfigSchema: []plugin.ConfigField{
			{
				Key: "host", Label: "主机地址", Type: plugin.FieldTypeText,
				Required: true, Placeholder: "192.168.1.1 或域名",
			},
			{
				Key: "port", Label: "SSH 端口", Type: plugin.FieldTypeNumber,
				Required: true, DefaultVal: 22,
			},
			{
				Key: "os_type", Label: "操作系统", Type: plugin.FieldTypeSelect,
				Required: false, DefaultVal: "linux",
				Options: []plugin.SelectOption{
					{Value: "linux", Label: "Linux"},
					{Value: "unix", Label: "Unix/BSD"},
				},
			},
			{
				Key: "jump_host", Label: "跳板机", Type: plugin.FieldTypeText,
				Required: false, Placeholder: "user@jump.host:22（可选）",
				Description: "通过跳板机中转连接目标服务器",
			},
		},
	})
}

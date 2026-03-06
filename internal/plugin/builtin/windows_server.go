package builtin

import "EnvPilot/internal/plugin"

func init() {
	plugin.Register(&plugin.PluginDef{
		TypeID:      "windows_server",
		DisplayName: "Windows 服务器",
		Category:    plugin.CategoryServer,
		IconName:    "monitor",
		ConfigSchema: []plugin.ConfigField{
			{
				Key: "host", Label: "主机地址", Type: plugin.FieldTypeText,
				Required: true, Placeholder: "192.168.1.2 或域名",
			},
			{
				Key: "port", Label: "RDP 端口", Type: plugin.FieldTypeNumber,
				Required: true, DefaultVal: 3389,
			},
			{
				Key: "protocol", Label: "协议", Type: plugin.FieldTypeSelect,
				Required: false, DefaultVal: "rdp",
				Options: []plugin.SelectOption{
					{Value: "rdp", Label: "RDP"},
					{Value: "winrm", Label: "WinRM"},
				},
			},
		},
	})
}

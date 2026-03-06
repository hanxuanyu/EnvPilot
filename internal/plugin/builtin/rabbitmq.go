package builtin

import "EnvPilot/internal/plugin"

func init() {
	plugin.Register(&plugin.PluginDef{
		TypeID:      "rabbitmq",
		DisplayName: "RabbitMQ",
		Category:    plugin.CategoryMQ,
		IconName:    "send",
		ConfigSchema: []plugin.ConfigField{
			{
				Key: "host", Label: "主机地址", Type: plugin.FieldTypeText,
				Required: true, Placeholder: "mq.example.com",
			},
			{
				Key: "port", Label: "AMQP 端口", Type: plugin.FieldTypeNumber,
				Required: true, DefaultVal: 5672,
			},
			{
				Key: "vhost", Label: "Virtual Host", Type: plugin.FieldTypeText,
				Required: false, DefaultVal: "/", Placeholder: "/",
			},
			{
				Key: "tls", Label: "启用 TLS", Type: plugin.FieldTypeBoolean,
				Required: false, DefaultVal: false,
			},
		},
	})
}

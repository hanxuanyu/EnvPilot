package rabbitmq

import (
	"EnvPilot/internal/plugin"
)

func init() {
	plugin.Register(&plugin.PluginDef{
		TypeID:             "rabbitmq",
		DisplayName:        "RabbitMQ",
		Category:           plugin.CategoryMQ,
		IconName:           "send",
		CredentialRequired: true,
		CredentialTypes:    []plugin.CredentialKind{plugin.CredentialKindPassword},
		Capabilities:       []plugin.Capability{plugin.CapabilityTestConnection, plugin.CapabilitySendMQMessage},
		IntegrationGuide: []string{
			"实现 MQConnector 并适配 exchange/routing key 语义",
			"在前端提供独立发送面板和历史视图",
		},
		ConfigSchema: []plugin.ConfigField{
			{Key: "host", Label: "主机地址", Type: plugin.FieldTypeText, Required: true, Placeholder: "mq.example.com"},
			{Key: "port", Label: "AMQP 端口", Type: plugin.FieldTypeNumber, Required: true, DefaultVal: 5672},
			{Key: "vhost", Label: "Virtual Host", Type: plugin.FieldTypeText, Required: false, DefaultVal: "/", Placeholder: "/"},
			{Key: "tls", Label: "启用 TLS", Type: plugin.FieldTypeBoolean, Required: false, DefaultVal: false},
		},
	})
}

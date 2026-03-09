package kafka

import (
	"EnvPilot/internal/plugin"
)

func init() {
	plugin.Register(&plugin.PluginDef{
		TypeID:             "kafka",
		DisplayName:        "Kafka",
		Category:           plugin.CategoryMQ,
		IconName:           "send",
		CredentialRequired: false,
		CredentialTypes:    []plugin.CredentialKind{plugin.CredentialKindPassword, plugin.CredentialKindToken, plugin.CredentialKindSASL},
		Capabilities:       []plugin.Capability{plugin.CapabilityTestConnection, plugin.CapabilitySendMQMessage},
		IntegrationGuide: []string{
			"实现 MQConnector 并按 security_protocol/sasl_mechanism 创建 dialer",
			"避免在审计中直接记录消息体全文",
		},
		ConfigSchema: []plugin.ConfigField{
			{Key: "brokers", Label: "Broker 地址列表", Type: plugin.FieldTypeText, Required: true, Placeholder: "kafka1:9092,kafka2:9092", Description: "多个 Broker 地址用逗号分隔"},
			{Key: "security_protocol", Label: "安全协议", Type: plugin.FieldTypeSelect, Required: false, DefaultVal: "PLAINTEXT", Options: []plugin.SelectOption{{Value: "PLAINTEXT", Label: "PLAINTEXT"}, {Value: "SASL_PLAINTEXT", Label: "SASL_PLAINTEXT"}, {Value: "SSL", Label: "SSL"}, {Value: "SASL_SSL", Label: "SASL_SSL"}}},
			{Key: "sasl_mechanism", Label: "SASL 机制", Type: plugin.FieldTypeSelect, Required: false, DefaultVal: "", Options: []plugin.SelectOption{{Value: "", Label: "无"}, {Value: "PLAIN", Label: "PLAIN"}, {Value: "SCRAM-SHA-256", Label: "SCRAM-SHA-256"}, {Value: "SCRAM-SHA-512", Label: "SCRAM-SHA-512"}}, Description: "仅在 SASL 协议时有效"},
		},
	})
}

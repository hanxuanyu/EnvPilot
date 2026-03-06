package builtin

import "EnvPilot/internal/plugin"

func init() {
	plugin.Register(&plugin.PluginDef{
		TypeID:      "kafka",
		DisplayName: "Kafka",
		Category:    plugin.CategoryMQ,
		IconName:    "send",
		ConfigSchema: []plugin.ConfigField{
			{
				Key: "brokers", Label: "Broker 地址列表", Type: plugin.FieldTypeText,
				Required: true, Placeholder: "kafka1:9092,kafka2:9092",
				Description: "多个 Broker 地址用逗号分隔",
			},
			{
				Key: "security_protocol", Label: "安全协议", Type: plugin.FieldTypeSelect,
				Required: false, DefaultVal: "PLAINTEXT",
				Options: []plugin.SelectOption{
					{Value: "PLAINTEXT", Label: "PLAINTEXT"},
					{Value: "SASL_PLAINTEXT", Label: "SASL_PLAINTEXT"},
					{Value: "SSL", Label: "SSL"},
					{Value: "SASL_SSL", Label: "SASL_SSL"},
				},
			},
			{
				Key: "sasl_mechanism", Label: "SASL 机制", Type: plugin.FieldTypeSelect,
				Required: false, DefaultVal: "",
				Options: []plugin.SelectOption{
					{Value: "", Label: "无"},
					{Value: "PLAIN", Label: "PLAIN"},
					{Value: "SCRAM-SHA-256", Label: "SCRAM-SHA-256"},
					{Value: "SCRAM-SHA-512", Label: "SCRAM-SHA-512"},
				},
				Description: "仅在 SASL 协议时有效",
			},
		},
	})
}

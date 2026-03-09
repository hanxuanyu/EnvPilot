package rocketmq

import (
	"EnvPilot/internal/plugin"
)

func init() {
	plugin.Register(&plugin.PluginDef{
		TypeID:             "rocketmq",
		DisplayName:        "RocketMQ",
		Category:           plugin.CategoryMQ,
		IconName:           "send",
		CredentialRequired: false,
		CredentialTypes:    []plugin.CredentialKind{plugin.CredentialKindToken, plugin.CredentialKindAccessKeyPair},
		Capabilities:       []plugin.Capability{plugin.CapabilityTestConnection, plugin.CapabilitySendMQMessage},
		IntegrationGuide: []string{
			"实现 MQConnector 并用 NameServer 解析 Producer",
			"优先使用 access_key_secret 凭据，缺失时再回退 ext_config",
		},
		ConfigSchema: []plugin.ConfigField{
			{Key: "name_server", Label: "NameServer 地址", Type: plugin.FieldTypeText, Required: true, Placeholder: "mq.example.com:9876", Description: "多个地址用分号分隔，如 ns1:9876;ns2:9876"},
			{Key: "broker", Label: "Broker 名称", Type: plugin.FieldTypeText, Required: false, Placeholder: "broker-a"},
			{Key: "group_id", Label: "Producer/Consumer Group", Type: plugin.FieldTypeText, Required: false, Placeholder: "GID_example"},
			{Key: "access_key", Label: "Access Key", Type: plugin.FieldTypeText, Required: false, Placeholder: "ACL 鉴权时填写"},
			{Key: "secret_key", Label: "Secret Key", Type: plugin.FieldTypePassword, Required: false, Secret: true, Placeholder: "ACL 鉴权时填写"},
		},
	})
}

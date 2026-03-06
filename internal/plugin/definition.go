// Package plugin 提供资产类型插件注册表，定义各类中间件的配置 Schema。
// 通过插件化设计，新增资产类型只需在 builtin/ 下注册一个插件定义，
// 无需修改资产管理核心逻辑。
package plugin

// AssetCategory 资产高层类别
type AssetCategory string

const (
	CategoryServer   AssetCategory = "server"
	CategoryDatabase AssetCategory = "database"
	CategoryCache    AssetCategory = "cache"
	CategoryMQ       AssetCategory = "mq"
	CategoryOther    AssetCategory = "other"
)

// ConfigFieldType 配置字段 UI 类型
type ConfigFieldType string

const (
	FieldTypeText     ConfigFieldType = "text"
	FieldTypeNumber   ConfigFieldType = "number"
	FieldTypePassword ConfigFieldType = "password"
	FieldTypeTextarea ConfigFieldType = "textarea"
	FieldTypeBoolean  ConfigFieldType = "boolean"
	FieldTypeSelect   ConfigFieldType = "select"
)

// SelectOption 下拉选项
type SelectOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// ConfigField 单个配置字段定义，驱动前端动态表单渲染
type ConfigField struct {
	Key         string          `json:"key"`
	Label       string          `json:"label"`
	Type        ConfigFieldType `json:"type"`
	Required    bool            `json:"required"`
	DefaultVal  interface{}     `json:"default_val,omitempty"`
	Options     []SelectOption  `json:"options,omitempty"`
	Placeholder string          `json:"placeholder,omitempty"`
	Description string          `json:"description,omitempty"`
	Secret      bool            `json:"secret,omitempty"`
}

// PluginDef 插件定义，描述一种资产类型的元信息和配置 Schema
type PluginDef struct {
	TypeID       string        `json:"type_id"`
	DisplayName  string        `json:"display_name"`
	Category     AssetCategory `json:"category"`
	IconName     string        `json:"icon_name"`
	ConfigSchema []ConfigField `json:"config_schema"`
}

package plugin

import (
	"fmt"
	"sync"
)

var (
	mu       sync.RWMutex
	registry = map[string]*PluginDef{}
)

// Register 注册插件定义，通常在各插件包的 init() 中调用
func Register(def *PluginDef) {
	mu.Lock()
	defer mu.Unlock()
	registry[def.TypeID] = def
}

// Get 按 TypeID 获取插件定义
func Get(typeID string) (*PluginDef, error) {
	mu.RLock()
	defer mu.RUnlock()
	def, ok := registry[typeID]
	if !ok {
		return nil, fmt.Errorf("插件类型 [%s] 未注册", typeID)
	}
	return def, nil
}

// List 列出所有已注册插件；传入空字符串时返回全部
func List(category AssetCategory) []*PluginDef {
	mu.RLock()
	defer mu.RUnlock()
	result := make([]*PluginDef, 0, len(registry))
	for _, def := range registry {
		if category == "" || def.Category == category {
			result = append(result, def)
		}
	}
	return result
}

// MustGet 获取插件，不存在则 panic（仅在初始化阶段使用）
func MustGet(typeID string) *PluginDef {
	def, err := Get(typeID)
	if err != nil {
		panic(err)
	}
	return def
}

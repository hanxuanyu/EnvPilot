package connector

import (
	"fmt"
	"sync"
)

type Factory func(target *Target) (Connector, error)

var (
	factoryMu sync.RWMutex
	factories = make(map[string]Factory)
)

func RegisterFactory(pluginType string, factory Factory) {
	if pluginType == "" {
		panic("connector: pluginType 不能为空")
	}
	if factory == nil {
		panic("connector: factory 不能为空")
	}

	factoryMu.Lock()
	defer factoryMu.Unlock()

	if _, exists := factories[pluginType]; exists {
		panic("connector: 重复注册工厂 " + pluginType)
	}
	factories[pluginType] = factory
}

func NewConnector(target *Target) (Connector, error) {
	if target == nil {
		return nil, fmt.Errorf("连接目标不能为空")
	}

	factoryMu.RLock()
	factory, ok := factories[target.PluginType]
	factoryMu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("未注册的连接器工厂: %s", target.PluginType)
	}

	return factory(target)
}

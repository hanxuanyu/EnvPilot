// Package event 定义统一的事件推送抽象接口。
//
// 桌面模式：由 executor_api.WailsEmitter 实现，底层调用 wailsruntime.EventsEmit。
// 服务端模式：由 api.BusEmitter 实现，通过 EventBus 路由到 SSE/WebSocket 响应。
package event

// Emitter 事件推送接口。
// event 为事件名称（如 "executor:output:42"），data 为任意负载。
type Emitter interface {
	Emit(event string, data interface{})
}

// Noop 空实现，用于测试或无需事件推送的场景。
type Noop struct{}

func (Noop) Emit(_ string, _ interface{}) {}

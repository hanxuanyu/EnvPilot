package api

import (
	"sync"

	"EnvPilot/pkg/event"
)

// Message 事件总线中的消息
type Message struct {
	Event string
	Data  interface{}
}

type subscription struct {
	ch chan Message
}

// EventBus 进程内发布 / 订阅总线。
// 用于将后台 goroutine（如 SSH 命令执行）产生的事件路由到 HTTP 响应（SSE）。
type EventBus struct {
	mu   sync.RWMutex
	subs map[string][]*subscription
}

// NewEventBus 创建事件总线
func NewEventBus() *EventBus {
	return &EventBus{subs: make(map[string][]*subscription)}
}

// Subscribe 订阅指定主题，返回消息 channel 和取消订阅函数。
// bufSize 建议设为 64 以避免发布方阻塞。
func (b *EventBus) Subscribe(topic string, bufSize int) (<-chan Message, func()) {
	sub := &subscription{ch: make(chan Message, bufSize)}

	b.mu.Lock()
	b.subs[topic] = append(b.subs[topic], sub)
	b.mu.Unlock()

	unsub := func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		list := b.subs[topic]
		for i, current := range list {
			if current == sub {
				b.subs[topic] = append(list[:i], list[i+1:]...)
				if len(b.subs[topic]) == 0 {
					delete(b.subs, topic)
				}
				break
			}
		}
	}
	return sub.ch, unsub
}

// Publish 向指定主题发布消息（非阻塞，channel 满时丢弃）
func (b *EventBus) Publish(topic string, data interface{}) {
	b.mu.RLock()
	list := make([]*subscription, len(b.subs[topic]))
	copy(list, b.subs[topic])
	b.mu.RUnlock()

	msg := Message{Event: topic, Data: data}
	for _, sub := range list {
		select {
		case sub.ch <- msg:
		default:
		}
	}
}

// BusEmitter 将 event.Emitter 接口桥接到 EventBus
type BusEmitter struct {
	Bus *EventBus
}

func (e *BusEmitter) Emit(ev string, data interface{}) {
	e.Bus.Publish(ev, data)
}

// Ensure BusEmitter implements event.Emitter
var _ event.Emitter = (*BusEmitter)(nil)

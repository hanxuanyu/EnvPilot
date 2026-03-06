// Package executorapi 定义执行器模块对前端暴露的所有接口。
// 使用独立包名避免与 internal/asset/api（package api）产生 Wails 绑定冲突。
package executorapi

// Result 统一 API 响应包装（与 asset/api 中的 Result 独立定义，避免跨模块依赖）
type Result[T any] struct {
	Ok      bool   `json:"ok"`
	Data    T      `json:"data"`
	Message string `json:"message"`
}

// OK 构造成功响应
func OK[T any](data T) Result[T] {
	return Result[T]{Ok: true, Data: data}
}

// Fail 构造失败响应
func Fail[T any](message string) Result[T] {
	return Result[T]{Ok: false, Message: message}
}

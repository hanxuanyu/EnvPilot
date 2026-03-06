// result.go 统一 API 响应结构体
// 所有 Wails 绑定方法使用此结构体返回，前端统一处理
package api

// Result 泛型响应包装
// 前端通过 result.ok 判断成功与否
type Result[T any] struct {
	// Ok 表示操作是否成功
	Ok      bool   `json:"ok"`
	// Data 成功时的返回数据
	Data    T      `json:"data"`
	// Message 失败时的错误信息
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

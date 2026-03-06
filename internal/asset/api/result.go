package assetapi

// Result 统一 API 响应结构体
type Result[T any] struct {
	Success bool   `json:"success"`
	Data    T      `json:"data,omitempty"`
	Message string `json:"message,omitempty"`
}

func OK[T any](data T) Result[T] {
	return Result[T]{Success: true, Data: data}
}

func Fail[T any](message string) Result[T] {
	return Result[T]{Success: false, Message: message}
}

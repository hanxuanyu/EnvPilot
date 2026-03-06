package api

import (
	"encoding/json"
	"net/http"
	"strconv"
)

// APIResult 统一 HTTP 响应格式（与 Wails 内部 Result[T] 保持一致）
type APIResult[T any] struct {
	Success bool   `json:"success"`
	Data    T      `json:"data"`
	Message string `json:"message,omitempty"`
}

// writeJSON 序列化并写入 JSON 响应
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeOK 写入成功响应
func writeOK[T any](w http.ResponseWriter, data T) {
	writeJSON(w, http.StatusOK, APIResult[T]{Success: true, Data: data})
}

// writeFail 写入失败响应
func writeFail(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, APIResult[any]{Success: false, Message: msg})
}

// decodeJSON 解析请求体 JSON
func decodeJSON(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}

// pathUint 从 URL 路径变量（Go 1.22+ ServeMux 格式）中解析 uint 参数
func pathUint(r *http.Request, key string) (uint, error) {
	val := r.PathValue(key)
	n, err := strconv.ParseUint(val, 10, 64)
	if err != nil {
		return 0, err
	}
	return uint(n), nil
}

// queryInt 从 URL 查询参数中解析 int，默认值 def
func queryInt(r *http.Request, key string, def int) int {
	if v := r.URL.Query().Get(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

// queryUint 从 URL 查询参数中解析 uint，默认值 0
func queryUint(r *http.Request, key string) uint {
	if v := r.URL.Query().Get(key); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			return uint(n)
		}
	}
	return 0
}

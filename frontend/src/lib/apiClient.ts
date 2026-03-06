/**
 * apiClient.ts — 服务端模式的 HTTP / WebSocket 通信封装
 *
 * 桌面模式（__APP_MODE__ === 'desktop'）使用 window.go.* 调用后端。
 * 服务端模式（__APP_MODE__ === 'server'）使用标准 fetch / WebSocket。
 *
 * 两种模式对外暴露相同的接口形状，调用方（services/*.ts）无需感知差异。
 */

declare const __APP_MODE__: string
declare const __API_BASE__: string

export const IS_SERVER_MODE = typeof __APP_MODE__ !== 'undefined' && __APP_MODE__ === 'server'

/** API 基础路径（服务端模式）。生产环境部署时可通过 __API_BASE__ 注入 */
const BASE = typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : ''

// ── 统一响应格式 ──────────────────────────────────────────────────

export interface ApiResult<T> {
  success: boolean
  data: T
  message?: string
}

/** 解包 ApiResult，失败时抛出 Error */
export function unwrapResult<T>(result: ApiResult<T>): T {
  if (!result.success) throw new Error(result.message || '操作失败')
  return result.data
}

// ── HTTP 请求封装 ─────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(BASE + path, window.location.origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '' && v !== 0) {
        url.searchParams.set(k, String(v))
      }
    }
  }

  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    opts.body = JSON.stringify(body)
  }

  const resp = await fetch(url.toString(), opts)
  const json: ApiResult<T> = await resp.json()
  return unwrapResult(json)
}

export const http = {
  get:    <T>(path: string, query?: Record<string, string | number | undefined>) =>
    request<T>('GET', path, undefined, query),
  post:   <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put:    <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

// ── WebSocket URL 工具 ────────────────────────────────────────────

/** 将当前页面 http(s):// 转换为 ws(s):// */
export function wsURL(path: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.host
  return `${proto}://${host}${BASE}${path}`
}

// ── SSE（Server-Sent Events）工具 ────────────────────────────────

export interface SSEMessage {
  type: string
  data: unknown
}

/**
 * 订阅 SSE 流。
 * @returns 取消订阅函数
 */
export function subscribeSSE(
  url: string,
  onMessage: (msg: SSEMessage) => void,
  onError?: (err: Event) => void,
): () => void {
  const es = new EventSource(BASE + url)

  es.onmessage = (e) => {
    try {
      const msg: SSEMessage = JSON.parse(e.data)
      onMessage(msg)
    } catch {
      // 忽略解析错误
    }
  }

  if (onError) {
    es.onerror = onError
  }

  return () => es.close()
}

// ── 终端 WebSocket 管理器 ─────────────────────────────────────────

interface TerminalWsCallbacks {
  onOutput: (data: string) => void    // base64 编码的 PTY 输出
  onClosed: () => void
  onError?: (msg: string) => void
}

class TerminalWebSocketManager {
  private sockets = new Map<string, WebSocket>()

  /**
   * 连接终端 WebSocket，等待 started 消息，返回 sessionId。
   * 连接成功后所有后续消息通过 callbacks 分发。
   */
  connect(assetId: number, callbacks: TerminalWsCallbacks): Promise<string> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsURL(`/ws/terminal?asset_id=${assetId}`))
      let sessionId = ''
      let resolved = false

      ws.onopen = () => {
        // WebSocket 建立后服务端会自动发送 started 消息
      }

      ws.onmessage = (e) => {
        let msg: { type: string; session_id?: string; data?: string; message?: string }
        try {
          msg = JSON.parse(e.data)
        } catch {
          return
        }

        switch (msg.type) {
          case 'started':
            sessionId = msg.session_id!
            this.sockets.set(sessionId, ws)
            resolved = true
            resolve(sessionId)
            break
          case 'output':
            if (resolved) callbacks.onOutput(msg.data || '')
            break
          case 'closed':
            if (resolved) callbacks.onClosed()
            this.sockets.delete(sessionId)
            ws.close()
            break
          case 'error':
            if (!resolved) {
              reject(new Error(msg.message || '终端连接失败'))
            } else {
              callbacks.onError?.(msg.message || '终端错误')
            }
            break
        }
      }

      ws.onerror = () => {
        if (!resolved) reject(new Error('WebSocket 连接失败'))
      }

      ws.onclose = () => {
        if (sessionId) {
          this.sockets.delete(sessionId)
          callbacks.onClosed()
        }
      }
    })
  }

  send(sessionId: string, msg: object): void {
    const ws = this.sockets.get(sessionId)
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  close(sessionId: string): void {
    const ws = this.sockets.get(sessionId)
    if (ws) {
      ws.send(JSON.stringify({ type: 'close' }))
      ws.close()
      this.sockets.delete(sessionId)
    }
  }
}

export const terminalWSManager = new TerminalWebSocketManager()

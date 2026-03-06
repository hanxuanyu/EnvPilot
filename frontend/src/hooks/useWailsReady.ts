// useWailsReady.ts
//
// 解决 Wails v2 页面刷新后桥接连接尚未就绪就触发 useEffect 的竞争问题：
//   - wails dev 模式下页面刷新会短暂断开 WebSocket 桥接
//   - 在桥接重新连接前调用 window.go.* 会立即失败
//   - 本 hook 通过 ping 轮询确认连接后再置 ready=true
//   - 同时监听 Go 侧 domReady 发出的 "backend:ready" 事件作为快速通道
//
// 浏览器模式兼容：
//   - 纯浏览器环境（无 Wails WebView）下 window.runtime / window.go 均不存在
//   - ping 轮询会持续失败，直到 MAX_WAIT_MS 超时后自动放行
//   - 所有 Wails 运行时调用通过 wailsRuntime 安全封装，不会崩溃
//
// 注意：不能使用"短时延迟后检测桥接是否存在"的方式来提前放行。
//   原因：wails dev 模式下 WebSocket 桥接本身也需要 ~100-400ms 才能注入
//   window.go / window.runtime，过早放行会导致页面渲染时 API 调用失败。
//   只有 ping() 成功才能可靠表明 window.go.* 全部可用。
import { useState, useEffect, useRef } from 'react'
import { EventsOnce } from '@/lib/wailsRuntime'
import { IS_SERVER_MODE } from '@/lib/apiClient'
import { ping } from '@/services/backendService'

const POLL_INTERVAL_MS = 80   // 轮询间隔
const MAX_WAIT_MS      = 6000 // 超时后直接放行（纯浏览器 / 极端情况兜底）

export function useWailsReady(): boolean {
  // 服务端模式下不需要等待 Wails 桥接，直接视为就绪
  const [ready, setReady] = useState(IS_SERVER_MODE)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (IS_SERVER_MODE) return  // 服务端模式：HTTP 随时可用，无需等待

    cancelledRef.current = false
    let timer: ReturnType<typeof setTimeout>

    const markReady = () => {
      if (!cancelledRef.current) setReady(true)
    }

    // 快速通道：监听 Go domReady 发出的事件（安全封装，桥接未就绪时为 no-op）
    EventsOnce('backend:ready', markReady)

    // 主通道：轮询 ping 直到成功
    // 只有 ping 成功才能确保 window.go.* 全部就绪，不提前放行
    const poll = async () => {
      const deadline = Date.now() + MAX_WAIT_MS
      const attempt = async () => {
        if (cancelledRef.current) return
        try {
          await ping()
          markReady()
        } catch {
          if (Date.now() < deadline) {
            timer = setTimeout(attempt, POLL_INTERVAL_MS)
          } else {
            // 超时仍放行，避免页面永远卡在加载态（纯浏览器无后端时触发）
            markReady()
          }
        }
      }
      await attempt()
    }

    poll()

    return () => {
      cancelledRef.current = true
      clearTimeout(timer)
    }
  }, [])

  return ready
}

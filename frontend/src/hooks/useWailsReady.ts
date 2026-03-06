// useWailsReady.ts
//
// 解决 Wails v2 页面刷新后桥接连接尚未就绪就触发 useEffect 的竞争问题：
//   - wails dev 模式下页面刷新会短暂断开 WebSocket 桥接
//   - 在桥接重新连接前调用 window.go.* 会立即失败
//   - 本 hook 通过 ping 轮询确认连接后再置 ready=true
//   - 同时监听 Go 侧 domReady 发出的 "backend:ready" 事件作为快速通道
import { useState, useEffect, useRef } from 'react'
import { EventsOnce } from '@wailsjs/runtime/runtime'
import { ping } from '@/services/backendService'

const POLL_INTERVAL_MS = 80   // 轮询间隔
const MAX_WAIT_MS      = 8000 // 超时后直接放行（极端情况兜底）

export function useWailsReady(): boolean {
  const [ready, setReady] = useState(false)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    let timer: ReturnType<typeof setTimeout>

    const markReady = () => {
      if (!cancelledRef.current) setReady(true)
    }

    // 快速通道：监听 Go domReady 发出的事件
    EventsOnce('backend:ready', markReady)

    // 主通道：轮询 ping 直到成功
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
            // 超时仍放行，避免页面永远卡在加载态
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

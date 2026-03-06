// TerminalPage.tsx  在线 SSH 终端（xterm.js，桌面 / 服务端双模式）
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Terminal, Power, PowerOff, Maximize2, Server } from 'lucide-react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { executorService } from '@/services/executorService'
import { IS_SERVER_MODE } from '@/lib/apiClient'
import { useAssetStore } from '@/store/assetStore'
import { Button } from '@/components/ui/button'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'

// xterm.js 深色主题配置
const XTERM_THEME = {
  background:    '#0d1117',
  foreground:    '#e6edf3',
  cursor:        '#58a6ff',
  cursorAccent:  '#0d1117',
  black:         '#21262d',
  red:           '#f85149',
  green:         '#3fb950',
  yellow:        '#d29922',
  blue:          '#58a6ff',
  magenta:       '#bc8cff',
  cyan:          '#76e3ea',
  white:         '#b1bac4',
  brightBlack:   '#6e7681',
  brightRed:     '#ff7b72',
  brightGreen:   '#56d364',
  brightYellow:  '#e3b341',
  brightBlue:    '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan:    '#87d8f4',
  brightWhite:   '#f0f6fc',
}

export default function TerminalPage() {
  const { assetId: paramAssetId } = useParams<{ assetId?: string }>()
  const navigate = useNavigate()
  const { assets, loadAssets } = useAssetStore()

  // 只显示 server 类别资产
  const serverAssets = assets.filter(a => a.category === 'server')

  const [selectedAssetId, setSelectedAssetId] = useState<number>(
    paramAssetId ? Number(paramAssetId) : 0
  )
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const termContainerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    loadAssets()
  }, [])

  // 同步 URL 参数
  useEffect(() => {
    if (paramAssetId) {
      setSelectedAssetId(Number(paramAssetId))
    }
  }, [paramAssetId])

  // 初始化 xterm.js
  const initXterm = useCallback(() => {
    if (!termContainerRef.current) return

    // 清理旧实例
    if (xtermRef.current) {
      xtermRef.current.dispose()
    }

    const term = new XTerm({
      theme: XTERM_THEME,
      fontFamily: '"Cascadia Code", "Fira Code", "Consolas", "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowTransparency: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(termContainerRef.current)
    fitAddon.fit()

    // 键盘输入 → 发送到 SSH 服务端
    term.onData((data) => {
      const sid = sessionIdRef.current
      if (sid) {
        executorService.sendInput(sid, data).catch(() => {
          // 忽略发送失败（会话可能已关闭）
        })
      }
    })

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    return { term, fitAddon }
  }, [])

  // 窗口大小变化时重新适应
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && connected) {
        fitAddonRef.current.fit()
        const term = xtermRef.current
        if (term && sessionIdRef.current) {
          executorService.resizeTerminal(sessionIdRef.current, term.cols, term.rows).catch(() => {})
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [connected])

  // 连接终端
  const connect = useCallback(async () => {
    if (!selectedAssetId) {
      toast.error('请先选择目标服务器')
      return
    }

    setConnecting(true)

    try {
      const { term } = initXterm() ?? {}
      if (!term) throw new Error('终端初始化失败')

      term.writeln('\x1b[1;34m正在连接到服务器...\x1b[0m')

      const handleOutput = (data: string) => {
        try {
          const bytes = atob(data)
          const arr = new Uint8Array(bytes.length)
          for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
          term.write(arr)
        } catch {
          term.write(data)
        }
      }
      const handleClosed = () => {
        term.writeln('\r\n\x1b[1;31m[会话已断开]\x1b[0m')
        setConnected(false)
        setSessionId(null)
        sessionIdRef.current = null
      }

      let sid: string
      if (IS_SERVER_MODE) {
        // 服务端模式：WebSocket 一步建立连接并注册回调
        sid = await executorService.connectTerminal(
          selectedAssetId,
          handleOutput,
          handleClosed,
          (msg) => toast.error(msg),
        )
      } else {
        // 桌面模式：Wails IPC
        sid = await executorService.startTerminal(selectedAssetId)
        executorService.onTerminalOutput(sid, handleOutput)
        executorService.onTerminalClosed(sid, handleClosed)
      }

      sessionIdRef.current = sid
      setSessionId(sid)

      // 初始尺寸上报
      setTimeout(() => {
        fitAddonRef.current?.fit()
        executorService.resizeTerminal(sid, term.cols, term.rows).catch(() => {})
      }, 100)

      setConnected(true)
      toast.success('终端已连接')
    } catch (e: any) {
      toast.error(e.message || '连接失败')
    } finally {
      setConnecting(false)
    }
  }, [selectedAssetId, initXterm])

  // 断开连接
  const disconnect = useCallback(async () => {
    const sid = sessionIdRef.current
    if (sid) {
      executorService.offTerminalOutput(sid)
      executorService.offTerminalClosed(sid)
      await executorService.closeTerminal(sid).catch(() => {})
      sessionIdRef.current = null
    }
    setSessionId(null)
    setConnected(false)

    if (xtermRef.current) {
      xtermRef.current.writeln('\r\n\x1b[1;33m[已主动断开连接]\x1b[0m')
    }
  }, [])

  // 全屏
  const toggleFullscreen = useCallback(() => {
    if (!termContainerRef.current) return
    if (!document.fullscreenElement) {
      termContainerRef.current.closest('.terminal-wrapper')?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  // 组件卸载时断开
  useEffect(() => {
    return () => {
      const sid = sessionIdRef.current
      if (sid) {
        executorService.offTerminalOutput(sid)
        executorService.offTerminalClosed(sid)
        executorService.closeTerminal(sid).catch(() => {})
      }
      xtermRef.current?.dispose()
    }
  }, [])

  const selectedAsset = serverAssets.find(a => a.id === selectedAssetId)

  return (
    <div className="h-full flex flex-col gap-3 animate-fade-in">
      {/* 紧凑工具栏：标题 + 控制区合并为单行 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 标题区 */}
        <div className="flex items-center gap-2 mr-2">
          <Terminal className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-base font-semibold text-foreground whitespace-nowrap">在线终端</h1>
        </div>

        {/* 分割线 */}
        <div className="h-5 w-px bg-border mx-1" />

        {/* 服务器选择：图标在 trigger 外侧，避免 SelectValue 渲染多行节点时错位 */}
        <div className="flex items-center h-8 rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-ring overflow-hidden">
          <span className="flex items-center px-2.5 border-r border-border h-full bg-muted/40 shrink-0">
            <Server className="w-3.5 h-3.5 text-muted-foreground" />
          </span>
          <Select
            value={String(selectedAssetId)}
            onValueChange={v => {
              if (connected) {
                toast.warning('请先断开当前连接再切换服务器')
                return
              }
              const id = Number(v)
              setSelectedAssetId(id)
              if (id) navigate(`/terminal/${id}`)
            }}
            disabled={connected}
          >
            <SelectTrigger className="w-[220px] h-8 border-0 shadow-none rounded-none focus:ring-0 text-sm">
              <SelectValue placeholder="选择目标服务器" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">— 选择服务器 —</SelectItem>
              {serverAssets.map(a => {
                const host = (a.ext_config?.['host'] as string) ?? ''
                const port = a.ext_config?.['port'] ?? ''
                return (
                  <SelectItem
                    key={a.id}
                    value={String(a.id)}
                    textValue={`${a.name}  ${host}:${port}`}
                  >
                    <span className="flex flex-col">
                      <span>{a.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{`${host}:${port}`}</span>
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {/* 连接 / 断开按钮 */}
        {!connected ? (
          <Button
            size="sm"
            onClick={connect}
            disabled={connecting || !selectedAssetId}
            loading={connecting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
          >
            {!connecting && <Power className="w-3.5 h-3.5" />}
            {connecting ? '连接中...' : '连接'}
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={disconnect} className="h-8">
            <PowerOff className="w-3.5 h-3.5" />
            断开
          </Button>
        )}

        {/* 状态 Badge */}
        <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${
          connected
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-muted/50 border-border text-muted-foreground'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/40'}`} />
          {connected ? `已连接 · ${selectedAsset?.name ?? ''}` : '未连接'}
        </div>

        {/* 快捷键提示（连接后显示） */}
        {connected && (
          <div className="flex gap-3 text-xs text-muted-foreground/60 ml-2">
            <span><kbd className="px-1 py-0.5 rounded bg-muted/30 font-mono text-[10px]">Ctrl+C</kbd> 中断</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted/30 font-mono text-[10px]">Ctrl+D</kbd> 退出</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted/30 font-mono text-[10px]">Ctrl+L</kbd> 清屏</span>
          </div>
        )}

        {/* 全屏按钮 */}
        {connected && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            title="全屏"
            className="ml-auto h-8 w-8"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* 终端容器 */}
      <div className="terminal-wrapper flex-1 rounded-xl border border-border overflow-hidden bg-[#0d1117] min-h-0">
        {!connected && !connecting && (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Terminal className="w-12 h-12 opacity-20" />
            <div className="text-center">
              <p className="text-sm font-medium">SSH 在线终端</p>
              <p className="text-xs mt-1 opacity-60">从上方选择服务器后点击「连接」</p>
            </div>
            {selectedAssetId > 0 && (
              <Button
                onClick={connect}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Power className="w-4 h-4" />
                立即连接
              </Button>
            )}
          </div>
        )}
        <div
          ref={termContainerRef}
          className="w-full h-full"
          style={{ display: connected || connecting ? 'block' : 'none' }}
        />
      </div>
    </div>
  )
}

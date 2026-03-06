// TerminalPage.tsx  在线 SSH 终端（xterm.js + Wails 事件，Task 3.5/3.6）
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Terminal, Power, PowerOff, Maximize2, Server, ChevronDown } from 'lucide-react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { executorService } from '@/services/executorService'
import { useAssetStore } from '@/store/assetStore'

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

  // 只显示 server 类型资产
  const serverAssets = assets.filter(a => a.type === 'server')

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

      const sid = await executorService.startTerminal(selectedAssetId)
      sessionIdRef.current = sid
      setSessionId(sid)

      // 订阅终端输出（base64 编码）
      executorService.onTerminalOutput(sid, (data: string) => {
        try {
          const bytes = atob(data)
          const arr = new Uint8Array(bytes.length)
          for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
          term.write(arr)
        } catch {
          term.write(data)
        }
      })

      // 订阅会话关闭事件
      executorService.onTerminalClosed(sid, () => {
        term.writeln('\r\n\x1b[1;31m[会话已断开]\x1b[0m')
        setConnected(false)
        setSessionId(null)
        sessionIdRef.current = null
      })

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
    <div className="h-full flex flex-col gap-4 animate-fade-in">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">在线终端</h1>
        <p className="text-sm text-muted-foreground mt-1">SSH PTY 终端 · xterm.js 渲染</p>
      </div>

      {/* 控制栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 服务器选择 */}
        <div className="relative">
          <select
            value={selectedAssetId}
            onChange={e => {
              if (connected) {
                toast.warning('请先断开当前连接再切换服务器')
                return
              }
              const id = Number(e.target.value)
              setSelectedAssetId(id)
              if (id) navigate(`/terminal/${id}`)
            }}
            disabled={connected}
            className="appearance-none bg-card border border-border rounded-lg pl-10 pr-8 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50 min-w-[220px]"
          >
            <option value={0}>— 选择服务器 —</option>
            {serverAssets.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}  {a.host}:{a.port}
              </option>
            ))}
          </select>
          <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* 连接 / 断开按钮 */}
        {!connected ? (
          <button
            onClick={connect}
            disabled={connecting || !selectedAssetId}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Power className="w-4 h-4" />
            {connecting ? '连接中...' : '连接'}
          </button>
        ) : (
          <button
            onClick={disconnect}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-700 text-white text-sm font-medium transition-colors"
          >
            <PowerOff className="w-4 h-4" />
            断开
          </button>
        )}

        {/* 状态指示 */}
        <div className={`flex items-center gap-1.5 text-sm ${connected ? 'text-emerald-400' : 'text-muted-foreground'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/40'}`} />
          {connected ? `已连接 · ${selectedAsset?.name ?? ''}` : '未连接'}
        </div>

        {connected && (
          <button
            onClick={toggleFullscreen}
            className="ml-auto p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="全屏"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 终端容器 */}
      <div className="terminal-wrapper flex-1 rounded-xl border border-border overflow-hidden bg-[#0d1117] min-h-0">
        {!connected && !connecting && (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Terminal className="w-12 h-12 opacity-20" />
            <div className="text-center">
              <p className="text-sm font-medium">SSH 在线终端</p>
              <p className="text-xs mt-1 opacity-60">选择服务器后点击「连接」</p>
            </div>
            {selectedAssetId > 0 && (
              <button
                onClick={connect}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
              >
                <Power className="w-4 h-4" />
                立即连接
              </button>
            )}
          </div>
        )}
        <div
          ref={termContainerRef}
          className="w-full h-full"
          style={{ display: connected || connecting ? 'block' : 'none' }}
        />
      </div>

      {/* 快捷键提示 */}
      {connected && (
        <div className="flex gap-4 text-xs text-muted-foreground/60 flex-wrap">
          <span><kbd className="px-1 py-0.5 rounded bg-muted/30 font-mono text-[10px]">Ctrl+C</kbd> 中断</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted/30 font-mono text-[10px]">Ctrl+D</kbd> 退出</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted/30 font-mono text-[10px]">Ctrl+L</kbd> 清屏</span>
          <span><kbd className="px-1 py-0.5 rounded bg-muted/30 font-mono text-[10px]">↑↓</kbd> 历史命令</span>
        </div>
      )}
    </div>
  )
}

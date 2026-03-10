// TerminalPage.tsx  在线 SSH 终端（xterm.js，桌面 / 服务端双模式）
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Terminal, Power, PowerOff, Maximize2, Server, Copy, ClipboardPaste } from 'lucide-react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { executorService } from '@/services/executorService'
import { IS_SERVER_MODE } from '@/lib/apiClient'
import { useTheme } from '@/lib/theme'
import { useAssetStore } from '@/store/assetStore'
import { Button } from '@/components/ui/button'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'

const XTERM_DARK_THEME = {
  background:    '#0d1117',
  foreground:    '#e6edf3',
  cursor:        '#58a6ff',
  cursorAccent:  '#0d1117',
  selectionBackground: '#1d4ed866',
  selectionInactiveBackground: '#1e3a8a4d',
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

const XTERM_LIGHT_THEME = {
  background:    '#f8fafc',
  foreground:    '#0f172a',
  cursor:        '#2563eb',
  cursorAccent:  '#f8fafc',
  selectionBackground: '#93c5fd99',
  selectionInactiveBackground: '#bfdbfe80',
  black:         '#334155',
  red:           '#dc2626',
  green:         '#16a34a',
  yellow:        '#ca8a04',
  blue:          '#2563eb',
  magenta:       '#9333ea',
  cyan:          '#0891b2',
  white:         '#cbd5e1',
  brightBlack:   '#64748b',
  brightRed:     '#ef4444',
  brightGreen:   '#22c55e',
  brightYellow:  '#eab308',
  brightBlue:    '#3b82f6',
  brightMagenta: '#a855f7',
  brightCyan:    '#06b6d4',
  brightWhite:   '#e2e8f0',
}

const AUTO_COPY_DELAY = 120

type ContextMenuState = {
  open: boolean
  x: number
  y: number
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function isCopyShortcut(event: KeyboardEvent) {
  return event.key.toLowerCase() === 'c' && (event.metaKey || (event.ctrlKey && event.shiftKey))
}

function isPasteShortcut(event: KeyboardEvent) {
  return event.key.toLowerCase() === 'v' && (event.metaKey || (event.ctrlKey && event.shiftKey))
}

function isSelectAllShortcut(event: KeyboardEvent) {
  return event.key.toLowerCase() === 'a' && (event.metaKey || (event.ctrlKey && event.shiftKey))
}

export default function TerminalPage() {
  const { assetId: paramAssetId } = useParams<{ assetId?: string }>()
  const navigate = useNavigate()
  const { assets, loadAssets } = useAssetStore()
  const { resolvedTheme } = useTheme()

  // 只显示 server 类别资产
  const serverAssets = assets.filter(a => a.category === 'server')

  const [selectedAssetId, setSelectedAssetId] = useState<number>(
    paramAssetId ? Number(paramAssetId) : 0
  )
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ open: false, x: 0, y: 0 })

  const termContainerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const terminalWrapperRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const autoCopyTimerRef = useRef<number | null>(null)

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
      theme: resolvedTheme === 'dark' ? XTERM_DARK_THEME : XTERM_LIGHT_THEME,
      fontFamily: '"Cascadia Code", "Fira Code", "Consolas", "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowTransparency: true,
      macOptionClickForcesSelection: true,
      rightClickSelectsWord: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(termContainerRef.current)
    fitAddon.fit()

    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true

      if (isSelectAllShortcut(event)) {
        event.preventDefault()
        term.selectAll()
        return false
      }

      if (isCopyShortcut(event) && term.hasSelection()) {
        event.preventDefault()
        void writeClipboardText(term.getSelection().trimEnd())
        return false
      }

      if (isPasteShortcut(event)) {
        event.preventDefault()
        void navigator.clipboard.readText().then((text) => {
          const sid = sessionIdRef.current
          if (!sid || !text) return
          void executorService.sendInput(sid, text)
        }).catch(() => {
          toast.error('读取剪贴板失败，请检查浏览器权限')
        })
        return false
      }

      return true
    })

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
  }, [resolvedTheme])

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => (prev.open ? { ...prev, open: false } : prev))
  }, [])

  const copySelection = useCallback(async (showToast = true) => {
    const term = xtermRef.current
    const selection = term?.getSelection()?.trimEnd() ?? ''
    if (!selection) {
      if (showToast) toast.warning('当前没有可复制的终端选中内容')
      return false
    }

    try {
      await writeClipboardText(selection)
      if (showToast) toast.success('已复制终端选中内容')
      return true
    } catch {
      toast.error('复制终端内容失败')
      return false
    }
  }, [])

  const pasteClipboard = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) {
      toast.warning('请先建立终端连接')
      return
    }

    try {
      const text = await navigator.clipboard.readText()
      if (!text) {
        toast.warning('剪贴板为空')
        return
      }
      await executorService.sendInput(sid, text)
      toast.success('已粘贴到终端')
    } catch {
      toast.error('读取剪贴板失败，请检查浏览器权限')
    }
  }, [])

  useEffect(() => {
    if (!termContainerRef.current) return

    const container = termContainerRef.current
    const handleMouseUp = () => {
      if (!xtermRef.current?.hasSelection()) return
      if (autoCopyTimerRef.current) window.clearTimeout(autoCopyTimerRef.current)
      autoCopyTimerRef.current = window.setTimeout(() => {
        void copySelection(false)
      }, AUTO_COPY_DELAY)
    }
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      const wrapperRect = terminalWrapperRef.current?.getBoundingClientRect()
      if (!wrapperRect) return
      setContextMenu({
        open: true,
        x: event.clientX - wrapperRect.left,
        y: event.clientY - wrapperRect.top,
      })
    }

    container.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('contextmenu', handleContextMenu)

    return () => {
      container.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [copySelection])

  useEffect(() => {
    if (!contextMenu.open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) return
      closeContextMenu()
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu()
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', closeContextMenu)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', closeContextMenu)
    }
  }, [contextMenu.open, closeContextMenu])

  useEffect(() => {
    return () => {
      if (autoCopyTimerRef.current) window.clearTimeout(autoCopyTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!xtermRef.current) return
    xtermRef.current.options.theme = resolvedTheme === 'dark' ? XTERM_DARK_THEME : XTERM_LIGHT_THEME
  }, [resolvedTheme])

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
      if (autoCopyTimerRef.current) window.clearTimeout(autoCopyTimerRef.current)
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
            <span>Cmd+A 全选终端内容</span>
            <span>Cmd+C 复制选区</span>
            <span>macOS 下按住 Option 拖拽选择文本</span>
          </div>
        )}

        {/* 全屏按钮 */}
        {connected && (
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                xtermRef.current?.selectAll()
              }}
              className="h-8"
            >
              全选
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void copySelection(true)
              }}
              className="h-8"
            >
              <Copy className="w-4 h-4" />
              复制
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              title="全屏"
              className="h-8 w-8"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* 终端容器 */}
      <div
        ref={terminalWrapperRef}
        className="terminal-wrapper relative flex-1 rounded-xl border border-border overflow-hidden min-h-0"
        style={{
          backgroundColor: resolvedTheme === 'dark' ? XTERM_DARK_THEME.background : XTERM_LIGHT_THEME.background,
        }}
      >
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

        {contextMenu.open && connected && (
          <div
            ref={contextMenuRef}
            className="absolute z-20 min-w-44 rounded-lg border border-border bg-popover/95 p-1 shadow-xl backdrop-blur"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={event => event.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-left text-foreground hover:bg-accent"
              onClick={() => {
                closeContextMenu()
                void copySelection(true)
              }}
            >
              <Copy className="h-4 w-4 text-muted-foreground" />
              复制选中内容
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-left text-foreground hover:bg-accent"
              onClick={() => {
                closeContextMenu()
                void pasteClipboard()
              }}
            >
              <ClipboardPaste className="h-4 w-4 text-muted-foreground" />
              粘贴到终端
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

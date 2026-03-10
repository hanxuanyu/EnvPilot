import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Terminal as TerminalIcon, Power, Copy, ClipboardPaste } from 'lucide-react'
import { toast } from 'sonner'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { executorService } from '@/services/executorService'
import { IS_SERVER_MODE } from '@/lib/apiClient'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'

const XTERM_DARK_THEME = {
  background: '#0d1117',
  foreground: '#e6edf3',
  cursor: '#58a6ff',
  cursorAccent: '#0d1117',
  selectionBackground: '#1d4ed866',
  selectionInactiveBackground: '#1e3a8a4d',
  black: '#21262d',
  red: '#f85149',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#76e3ea',
  white: '#b1bac4',
  brightBlack: '#6e7681',
  brightRed: '#ff7b72',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#87d8f4',
  brightWhite: '#f0f6fc',
}

const XTERM_LIGHT_THEME = {
  background: '#f8fafc',
  foreground: '#0f172a',
  cursor: '#2563eb',
  cursorAccent: '#f8fafc',
  selectionBackground: '#93c5fd99',
  selectionInactiveBackground: '#bfdbfe80',
  black: '#334155',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#ca8a04',
  blue: '#2563eb',
  magenta: '#9333ea',
  cyan: '#0891b2',
  white: '#cbd5e1',
  brightBlack: '#64748b',
  brightRed: '#ef4444',
  brightGreen: '#22c55e',
  brightYellow: '#eab308',
  brightBlue: '#3b82f6',
  brightMagenta: '#a855f7',
  brightCyan: '#06b6d4',
  brightWhite: '#e2e8f0',
}

const AUTO_COPY_DELAY = 120

type ContextMenuState = {
  open: boolean
  x: number
  y: number
}

export type TerminalSessionState = {
  connected: boolean
  connecting: boolean
  sessionId: string | null
}

export type TerminalSessionHandle = {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  selectAll: () => void
  copySelection: (showToast?: boolean) => Promise<boolean>
  pasteClipboard: () => Promise<void>
  toggleFullscreen: () => void
}

type TerminalSessionProps = {
  assetId: number
  assetName?: string
  standalone?: boolean
  autoConnect?: boolean
  onConnectionStateChange?: (state: TerminalSessionState) => void
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

const TerminalSession = forwardRef<TerminalSessionHandle, TerminalSessionProps>(function TerminalSession(
  { assetId, assetName, standalone = false, autoConnect = false, onConnectionStateChange },
  ref,
) {
  const { resolvedTheme } = useTheme()
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
  const autoConnectTriggeredRef = useRef(false)

  useEffect(() => {
    onConnectionStateChange?.({ connected, connecting, sessionId })
  }, [connected, connecting, onConnectionStateChange, sessionId])

  useEffect(() => {
    if (!standalone) return
    document.title = assetId ? `SSH 终端 · ${assetName ?? assetId}` : 'SSH 终端'
  }, [assetId, assetName, standalone])

  const initXterm = useCallback(() => {
    if (!termContainerRef.current) return

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

    term.onData((data) => {
      const sid = sessionIdRef.current
      if (sid) {
        executorService.sendInput(sid, data).catch(() => {})
      }
    })

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    return { term }
  }, [resolvedTheme])

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => (prev.open ? { ...prev, open: false } : prev))
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
  }, [closeContextMenu, contextMenu.open])

  useEffect(() => {
    return () => {
      if (autoCopyTimerRef.current) window.clearTimeout(autoCopyTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!xtermRef.current) return
    xtermRef.current.options.theme = resolvedTheme === 'dark' ? XTERM_DARK_THEME : XTERM_LIGHT_THEME
  }, [resolvedTheme])

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

  const connect = useCallback(async () => {
    if (!assetId) {
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
          for (let index = 0; index < bytes.length; index += 1) arr[index] = bytes.charCodeAt(index)
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
        sid = await executorService.connectTerminal(assetId, handleOutput, handleClosed, (message) => toast.error(message))
      } else {
        sid = await executorService.startTerminal(assetId)
        executorService.onTerminalOutput(sid, handleOutput)
        executorService.onTerminalClosed(sid, handleClosed)
      }

      sessionIdRef.current = sid
      setSessionId(sid)

      window.setTimeout(() => {
        fitAddonRef.current?.fit()
        executorService.resizeTerminal(sid, term.cols, term.rows).catch(() => {})
      }, 100)

      setConnected(true)
      toast.success('终端已连接')
    } catch (error: any) {
      toast.error(error.message || '连接失败')
    } finally {
      setConnecting(false)
    }
  }, [assetId, initXterm])

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

  useEffect(() => {
    autoConnectTriggeredRef.current = false
  }, [assetId, autoConnect])

  useEffect(() => {
    if (!autoConnect || autoConnectTriggeredRef.current) return
    if (!assetId || connected || connecting) return

    autoConnectTriggeredRef.current = true
    void connect()
  }, [assetId, autoConnect, connect, connected, connecting])

  const toggleFullscreen = useCallback(() => {
    if (!termContainerRef.current) return
    if (!document.fullscreenElement) {
      termContainerRef.current.closest('.terminal-wrapper')?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  useImperativeHandle(ref, () => ({
    connect,
    disconnect,
    selectAll: () => xtermRef.current?.selectAll(),
    copySelection,
    pasteClipboard,
    toggleFullscreen,
  }), [connect, copySelection, disconnect, pasteClipboard, toggleFullscreen])

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

  return (
    <div className={standalone ? 'h-screen w-screen overflow-hidden bg-background' : 'h-full min-h-0'}>
      <div
        ref={terminalWrapperRef}
        className={standalone ? 'terminal-wrapper relative h-full w-full overflow-hidden' : 'terminal-wrapper relative h-full rounded-xl border border-border overflow-hidden'}
        style={{
          backgroundColor: resolvedTheme === 'dark' ? XTERM_DARK_THEME.background : XTERM_LIGHT_THEME.background,
        }}
      >
        {!connected && !connecting && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
            <TerminalIcon className="h-12 w-12 opacity-20" />
            <div className="text-center">
              <p className="text-sm font-medium">SSH 在线终端</p>
              <p className="mt-1 text-xs opacity-60">
                {standalone ? '正在准备独立终端窗口…' : assetId ? '点击上方连接按钮开始会话' : '请先选择目标服务器'}
              </p>
            </div>
            {standalone && assetId > 0 && (
              <Button onClick={() => void connect()} loading={connecting} className="bg-emerald-600 text-white hover:bg-emerald-700">
                {!connecting && <Power className="h-4 w-4" />}
                {connecting ? '连接中...' : '重新连接'}
              </Button>
            )}
          </div>
        )}

        <div ref={termContainerRef} className="h-full w-full" style={{ display: connected || connecting ? 'block' : 'none' }} />

        {contextMenu.open && connected && (
          <div
            ref={contextMenuRef}
            className="absolute z-20 min-w-44 rounded-lg border border-border bg-popover/95 p-1 shadow-xl backdrop-blur"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
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
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
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
})

export default TerminalSession
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Copy, Maximize2, Power, PowerOff, Server, SquareArrowOutUpRight, Terminal } from 'lucide-react'
import TerminalSession, { type TerminalSessionHandle, type TerminalSessionState } from '@/components/terminal/TerminalSession'
import { IS_SERVER_MODE } from '@/lib/apiClient'
import { openDesktopTerminalWindow } from '@/services/backendService'
import { useAssetStore } from '@/store/assetStore'
import { Button } from '@/components/ui/button'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
const INITIAL_TERMINAL_STATE: TerminalSessionState = {
  connected: false,
  connecting: false,
  sessionId: null,
}

export default function TerminalPage() {
  const { assetId: paramAssetId } = useParams<{ assetId?: string }>()
  const navigate = useNavigate()
  const { assets, loadAssets } = useAssetStore()
  const sessionRef = useRef<TerminalSessionHandle | null>(null)

  const serverAssets = assets.filter((asset) => asset.category === 'server')
  const [selectedAssetId, setSelectedAssetId] = useState<number>(paramAssetId ? Number(paramAssetId) : 0)
  const [terminalState, setTerminalState] = useState<TerminalSessionState>(INITIAL_TERMINAL_STATE)

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  useEffect(() => {
    if (paramAssetId) {
      setSelectedAssetId(Number(paramAssetId))
      return
    }
    setSelectedAssetId(0)
  }, [paramAssetId])

  const selectedAsset = serverAssets.find((asset) => asset.id === selectedAssetId)

  const openInNewWindow = async () => {
    if (!selectedAssetId) {
      toast.error('请先选择目标服务器')
      return
    }

    if (IS_SERVER_MODE) {
      const url = new URL(`/terminal-window/${selectedAssetId}`, window.location.origin)
      url.searchParams.set('autoconnect', '1')
      const newWindow = window.open(
        url.toString(),
        '_blank',
        'popup=yes,width=1280,height=820,resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no',
      )
      if (!newWindow) {
        toast.error('新窗口被浏览器拦截，请允许弹窗后重试')
        return
      }
      toast.success('已打开新的终端窗口')
      return
    }

    try {
      await openDesktopTerminalWindow(selectedAssetId)
      toast.success('已打开新的桌面终端窗口')
    } catch (error: any) {
      toast.error(error.message || '打开桌面终端窗口失败')
    }
  }

  return (
    <div className="h-full animate-fade-in">
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="mr-2 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-muted-foreground" />
            <h1 className="whitespace-nowrap text-base font-semibold text-foreground">在线终端</h1>
          </div>

          <div className="mx-1 h-5 w-px bg-border" />

          <div className="flex h-8 items-center overflow-hidden rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-ring">
            <span className="flex h-full shrink-0 items-center border-r border-border bg-muted/40 px-2.5">
              <Server className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <Select
              value={String(selectedAssetId)}
              onValueChange={(value) => {
                if (terminalState.connected) {
                  toast.warning('请先断开当前连接再切换服务器')
                  return
                }
                const id = Number(value)
                setSelectedAssetId(id)
                navigate(id ? `/terminal/${id}` : '/terminal')
              }}
              disabled={terminalState.connected}
            >
              <SelectTrigger className="h-8 w-[220px] rounded-none border-0 text-sm shadow-none focus:ring-0">
                <SelectValue placeholder="选择目标服务器" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">— 选择服务器 —</SelectItem>
                {serverAssets.map((asset) => {
                  const host = (asset.ext_config?.host as string) ?? ''
                  const port = asset.ext_config?.port ?? ''
                  return (
                    <SelectItem
                      key={asset.id}
                      value={String(asset.id)}
                      textValue={`${asset.name} ${host}:${port}`}
                    >
                      <span className="flex flex-col">
                        <span>{asset.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{`${host}:${port}`}</span>
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {!terminalState.connected ? (
            <Button
              size="sm"
              onClick={() => void sessionRef.current?.connect()}
              disabled={terminalState.connecting || !selectedAssetId}
              loading={terminalState.connecting}
              className="h-8 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {!terminalState.connecting && <Power className="h-3.5 w-3.5" />}
              {terminalState.connecting ? '连接中...' : '连接'}
            </Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => void sessionRef.current?.disconnect()} className="h-8">
              <PowerOff className="h-3.5 w-3.5" />
              断开
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => void openInNewWindow()}
            disabled={!selectedAssetId || terminalState.connecting}
            className="h-8"
          >
            <SquareArrowOutUpRight className="h-3.5 w-3.5" />
            新窗口连接
          </Button>

          <div className={`rounded-full border px-2 py-1 text-xs ${
            terminalState.connected
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-border bg-muted/50 text-muted-foreground'
          }`}>
            <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${terminalState.connected ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/40'}`} />
            {terminalState.connected ? `已连接 · ${selectedAsset?.name ?? ''}` : '未连接'}
          </div>

          {terminalState.connected && (
            <div className="ml-2 flex gap-3 text-xs text-muted-foreground/60">
              <span>Cmd+A 全选终端内容</span>
              <span>Cmd+C 复制选区</span>
              <span>macOS 下按住 Option 拖拽选择文本</span>
            </div>
          )}

          {terminalState.connected && (
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => sessionRef.current?.selectAll()} className="h-8">
                全选
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void sessionRef.current?.copySelection(true)} className="h-8">
                <Copy className="h-4 w-4" />
                复制
              </Button>
              <Button variant="ghost" size="icon" onClick={() => sessionRef.current?.toggleFullscreen()} title="全屏" className="h-8 w-8">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1">
          <TerminalSession
            ref={sessionRef}
            assetId={selectedAssetId}
            assetName={selectedAsset?.name}
            onConnectionStateChange={setTerminalState}
          />
        </div>
      </div>
    </div>
  )
}

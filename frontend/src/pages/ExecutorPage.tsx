// ExecutorPage.tsx  SSH 命令执行页面
import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Terminal, Play, AlertTriangle, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronRight, RefreshCw, Layers, X,
} from 'lucide-react'
import { executorService, type Execution } from '@/services/executorService'
import { useExecutorStore } from '@/store/executorStore'
import { useAssetStore } from '@/store/assetStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'

// ── 工具函数 ──────────────────────────────────────────────────
function formatDuration(e: Execution): string {
  if (!e.finished_at) return '执行中...'
  const ms = new Date(e.finished_at).getTime() - new Date(e.started_at).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function statusColor(status: string) {
  switch (status) {
    case 'success':     return 'text-emerald-400'
    case 'failed':      return 'text-red-400'
    case 'running':     return 'text-blue-400'
    case 'interrupted': return 'text-yellow-400'
    default:            return 'text-muted-foreground'
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'success':     return <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
    case 'failed':      return <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
    case 'running':     return <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin flex-shrink-0" />
    case 'interrupted': return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
    default:            return <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
  }
}

// ── 结果标签类型 ──────────────────────────────────────────────
interface ResultTab {
  execId: number
  assetId: number
  assetName: string
  assetHost: string
  status: string
  output: string
  isLive: boolean
}

// ── 危险命令确认对话框 ────────────────────────────────────────
interface DangerConfirmProps {
  command: string
  onConfirm: () => void
  onCancel: () => void
}
function DangerConfirm({ command, onConfirm, onCancel }: DangerConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-red-500/10">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">高危命令警告</h3>
            <p className="text-xs text-muted-foreground">此操作可能造成不可逆损害</p>
          </div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
          <code className="text-sm text-red-300 font-mono break-all">{command}</code>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          系统检测到该命令可能包含高危操作（如删除系统文件、格式化磁盘、关机重启等）。
          确认后将强制执行，<span className="text-red-400 font-medium">操作不可撤销</span>。
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button variant="destructive" onClick={onConfirm}>确认强制执行</Button>
        </div>
      </div>
    </div>
  )
}

// ── 多标签输出面板 ────────────────────────────────────────────
interface MultiOutputPanelProps {
  tabs: ResultTab[]
  activeExecId: number | null
  onTabChange: (execId: number) => void
  onTabClose?: (execId: number) => void
}

function MultiOutputPanel({ tabs, activeExecId, onTabChange, onTabClose }: MultiOutputPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const activeTab = tabs.find(t => t.execId === activeExecId) ?? tabs[0] ?? null

  // 输出有新内容时自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeTab?.output])

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0d14] rounded-lg border border-border">
        <div className="text-center">
          <Terminal className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">选择资产并输入命令开始执行</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0a0d14] rounded-lg border border-border overflow-hidden min-h-0">
      {/* 标签栏（多个标签时显示，单标签时仅显示状态头部） */}
      {tabs.length > 1 ? (
        <div className="flex border-b border-border bg-[#0d1017] overflow-x-auto flex-shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.execId}
              onClick={() => onTabChange(tab.execId)}
              className={`group flex items-center gap-1.5 px-3 py-2 text-xs border-r border-border whitespace-nowrap transition-colors flex-shrink-0 ${
                tab.execId === (activeTab?.execId)
                  ? 'bg-[#0a0d14] text-foreground border-b-[#0a0d14]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[#0a0d14]/50'
              }`}
            >
              {statusIcon(tab.status)}
              <span className="max-w-[120px] truncate">{tab.assetName}</span>
              {tab.isLive && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">LIVE</span>
              )}
              {!tab.isLive && onTabClose && (
                <span
                  className="opacity-0 group-hover:opacity-100 ml-0.5 p-0.5 rounded hover:bg-white/10"
                  onClick={e => { e.stopPropagation(); onTabClose(tab.execId) }}
                >
                  <X className="w-2.5 h-2.5" />
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        /* 单标签：紧凑状态头 */
        <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            {statusIcon(activeTab?.status ?? '')}
            <span className={`text-xs font-medium ${statusColor(activeTab?.status ?? '')}`}>
              {activeTab?.status === 'running' ? '执行中'
                : activeTab?.status === 'success' ? '执行成功'
                : activeTab?.status === 'failed' ? '执行失败'
                : activeTab?.status ?? ''}
            </span>
            {activeTab?.isLive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">LIVE</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-mono">
              {activeTab?.assetName} · {activeTab?.assetHost}
            </span>
            <span className="text-xs text-muted-foreground">Exec #{activeTab?.execId}</span>
          </div>
        </div>
      )}

      {/* 多标签时显示当前标签的服务器信息 */}
      {tabs.length > 1 && activeTab && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-[#0a0d14] flex-shrink-0">
          <span className={`text-xs font-medium ${statusColor(activeTab.status)}`}>
            {activeTab.status === 'running' ? '执行中'
              : activeTab.status === 'success' ? '执行成功'
              : activeTab.status === 'failed' ? '执行失败'
              : activeTab.status}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {activeTab.assetHost} · Exec #{activeTab.execId}
          </span>
        </div>
      )}

      {/* 输出内容 */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
          {activeTab?.output
            ? activeTab.output
            : <span className="text-muted-foreground/50 italic">
                {activeTab?.isLive ? '等待输出...' : '无输出'}
              </span>
          }
        </pre>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ── 历史记录列表行 ────────────────────────────────────────────
interface HistoryRowProps {
  exec: Execution
  onView: (exec: Execution) => void
}
function HistoryRow({ exec, onView }: HistoryRowProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-2.5 w-8">
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            {statusIcon(exec.status)}
          </div>
        </td>
        <td className="px-3 py-2.5">
          <div className="text-sm font-medium text-foreground">{exec.asset_name}</div>
          <div className="text-xs text-muted-foreground">{exec.asset_host}</div>
        </td>
        <td className="px-3 py-2.5 max-w-xs">
          <code className="text-xs font-mono text-slate-300 truncate block">{exec.command}</code>
        </td>
        <td className="px-3 py-2.5 text-xs text-muted-foreground">{exec.operator}</td>
        <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDuration(exec)}</td>
        <td className="px-3 py-2.5 text-xs text-muted-foreground">
          {new Date(exec.created_at).toLocaleString('zh-CN')}
        </td>
        <td className="px-3 py-2.5">
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={(e) => { e.stopPropagation(); onView(exec) }}
          >
            查看
          </Button>
        </td>
      </tr>
      {expanded && exec.output && (
        <tr className="border-b border-border bg-[#0a0d14]">
          <td colSpan={8} className="px-4 py-3">
            <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
              {exec.output}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

// ── 主页面 ────────────────────────────────────────────────────
export default function ExecutorPage() {
  const { assets, loadEnvironments, loadAssets } = useAssetStore()
  const { executions, loading, setExecuting, executing, loadExecutions } = useExecutorStore()

  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([])
  const [command, setCommand] = useState('')
  const [dangerCommand, setDangerCommand] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'execute' | 'history'>('execute')
  const [historyAssetId, setHistoryAssetId] = useState(0)
  const [historyPage] = useState(1)

  // 结果标签状态（替代原来的 currentExecId / outputBuffer）
  const [resultTabs, setResultTabs] = useState<ResultTab[]>([])
  const [activeResultExecId, setActiveResultExecId] = useState<number | null>(null)

  // SSE / Wails 事件订阅的清理函数
  const unsubRefs = useRef<Map<number, () => void>>(new Map())

  // 只显示 server 类别资产
  const serverAssets = assets.filter(a => a.category === 'server')

  useEffect(() => {
    loadEnvironments()
    loadAssets()
    loadExecutions({ page: 1, page_size: 20 })
  }, [])

  // 组件卸载时取消所有订阅
  useEffect(() => {
    return () => {
      for (const unsub of unsubRefs.current.values()) unsub()
    }
  }, [])

  /**
   * 为指定 execId 建立实时输出订阅（SSE / Wails 事件，自动感知模式）
   */
  const subscribeExec = useCallback((execId: number) => {
    // 清理同一 execId 的旧订阅（如果有）
    unsubRefs.current.get(execId)?.()

    const unsub = executorService.subscribeExecution(
      execId,
      // onOutput：追加 chunk 到对应标签
      (chunk) => {
        setResultTabs(prev =>
          prev.map(t => t.execId === execId ? { ...t, output: t.output + chunk } : t)
        )
      },
      // onDone：更新最终状态和完整输出
      (data) => {
        setResultTabs(prev =>
          prev.map(t => t.execId === execId
            ? {
                ...t,
                status: (data.status as string) || t.status,
                isLive: false,
                // 优先使用 done 事件携带的完整输出（包含已完成执行的 DB 记录）
                output: (data.output as string) || t.output,
              }
            : t
          )
        )
        unsubRefs.current.delete(execId)
        // 所有订阅都结束后刷新历史（延迟一帧确保 DB 已写入）
        setTimeout(() => {
          if (unsubRefs.current.size === 0) {
            loadExecutions({ page: 1, page_size: 20 })
          }
        }, 200)
      },
    )
    unsubRefs.current.set(execId, unsub)
  }, [loadExecutions])

  const handleExecute = useCallback(async (force = false) => {
    if (selectedAssetIds.length === 0) {
      toast.error('请先选择目标资产')
      return
    }
    if (!command.trim()) {
      toast.error('请输入要执行的命令')
      return
    }

    try {
      setExecuting(true)
      setDangerCommand(null)

      // 清理上一批执行的所有订阅，避免旧事件干扰新执行
      for (const unsub of unsubRefs.current.values()) unsub()
      unsubRefs.current.clear()

      if (selectedAssetIds.length === 1) {
        // ── 单资产执行 ──
        const result = await executorService.execute({
          asset_id: selectedAssetIds[0],
          command: command.trim(),
          force,
        })

        if (result.dangerous) {
          setDangerCommand(command.trim())
          setExecuting(false)
          return
        }

        if (result.execution) {
          const exec = result.execution
          const newTab: ResultTab = {
            execId: exec.id,
            assetId: exec.asset_id,
            assetName: exec.asset_name,
            assetHost: exec.asset_host,
            status: 'running',
            output: '',
            isLive: true,
          }
          setResultTabs([newTab])
          setActiveResultExecId(exec.id)
          setActiveTab('execute')
          subscribeExec(exec.id)
        }
        setExecuting(false)

      } else {
        // ── 批量执行 ──
        const result = await executorService.batchExecute({
          asset_ids: selectedAssetIds,
          command: command.trim(),
          force,
        })

        if (result.dangerous) {
          setDangerCommand(command.trim())
          setExecuting(false)
          return
        }

        const newTabs: ResultTab[] = result.results
          .filter(r => r.execution)
          .map(r => ({
            execId: r.execution!.id,
            assetId: r.execution!.asset_id,
            assetName: r.execution!.asset_name,
            assetHost: r.execution!.asset_host,
            status: 'running',
            output: '',
            isLive: true,
          }))

        setResultTabs(newTabs)
        setActiveResultExecId(newTabs[0]?.execId ?? null)
        setActiveTab('execute')

        toast.success(`已向 ${newTabs.length} 台服务器发起执行`)

        // 为每台服务器单独订阅实时输出
        newTabs.forEach(tab => subscribeExec(tab.execId))
        setExecuting(false)
      }
    } catch (e: any) {
      toast.error(e.message)
      setExecuting(false)
    }
  }, [selectedAssetIds, command, subscribeExec])

  const toggleAsset = (id: number) => {
    setSelectedAssetIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleHistoryLoad = async () => {
    await loadExecutions({ asset_id: historyAssetId, page: historyPage, page_size: 20 })
  }

  // 从历史记录查看执行详情
  const handleViewExecution = (exec: Execution) => {
    const tab: ResultTab = {
      execId: exec.id,
      assetId: exec.asset_id,
      assetName: exec.asset_name,
      assetHost: exec.asset_host,
      status: exec.status,
      output: exec.output || '',
      isLive: false,
    }
    setResultTabs([tab])
    setActiveResultExecId(exec.id)
    setActiveTab('execute')
  }

  // 关闭输出标签
  const handleCloseTab = (execId: number) => {
    unsubRefs.current.get(execId)?.()
    unsubRefs.current.delete(execId)
    setResultTabs(prev => {
      const next = prev.filter(t => t.execId !== execId)
      if (activeResultExecId === execId) {
        setActiveResultExecId(next[0]?.execId ?? null)
      }
      return next
    })
  }

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">命令执行</h1>
        <p className="text-sm text-muted-foreground mt-1">SSH 命令执行 · 支持单台 / 批量 · 实时输出</p>
      </div>

      {/* 主标签页切换 */}
      <div className="flex gap-1 border-b border-border pb-0">
        {(['execute', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab
                ? 'bg-card border border-b-card border-border text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'execute' ? '执行' : '历史记录'}
          </button>
        ))}
      </div>

      {/* 执行 Tab */}
      {activeTab === 'execute' && (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* 左侧：资产选择 */}
          <div className="w-56 flex-shrink-0 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                选择服务器
              </span>
              {selectedAssetIds.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                  {selectedAssetIds.length}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {serverAssets.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">暂无服务器资产</p>
              ) : (
                serverAssets.map(asset => (
                  <label
                    key={asset.id}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      selectedAssetIds.includes(asset.id)
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border hover:border-border/80 hover:bg-muted/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAssetIds.includes(asset.id)}
                      onChange={() => toggleAsset(asset.id)}
                      className="mt-0.5 accent-primary"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{asset.name}</div>
                      <div className="text-xs text-muted-foreground truncate font-mono">
                        {`${(asset.ext_config?.['host'] as string) ?? ''}:${asset.ext_config?.['port'] ?? ''}`}
                      </div>
                      {asset.environment && (
                        <div
                          className="text-[10px] mt-0.5 inline-block px-1.5 rounded"
                          style={{ background: asset.environment.color + '22', color: asset.environment.color }}
                        >
                          {asset.environment.name}
                        </div>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
            {selectedAssetIds.length > 1 && (
              <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Layers className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span className="text-xs text-blue-400">批量执行模式</span>
              </div>
            )}
          </div>

          {/* 右侧：命令输入 + 多标签输出 */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            {/* 命令输入区 */}
            <div className="bg-card border border-border rounded-xl p-4 flex-shrink-0">
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                SSH 命令
              </label>
              <Textarea
                value={command}
                onChange={e => setCommand(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    handleExecute()
                  }
                }}
                placeholder="输入要执行的 Shell 命令，Ctrl+Enter 快速执行"
                rows={3}
                className="font-mono"
              />
              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-1.5 flex-wrap">
                  {['uptime', 'df -h', 'free -m', 'top -bn1 | head -20', 'systemctl status nginx'].map(cmd => (
                    <Button
                      key={cmd}
                      variant="ghost"
                      size="sm"
                      onClick={() => setCommand(cmd)}
                      className="text-xs font-mono h-7 px-2 text-muted-foreground"
                    >
                      {cmd}
                    </Button>
                  ))}
                </div>
                <Button
                  onClick={() => handleExecute()}
                  disabled={executing || selectedAssetIds.length === 0 || !command.trim()}
                  loading={executing}
                >
                  {!executing && <Play className="w-4 h-4" />}
                  {selectedAssetIds.length > 1 ? `批量执行 (${selectedAssetIds.length})` : '执行'}
                </Button>
              </div>
            </div>

            {/* 多标签输出面板 */}
            <MultiOutputPanel
              tabs={resultTabs}
              activeExecId={activeResultExecId}
              onTabChange={setActiveResultExecId}
              onTabClose={handleCloseTab}
            />
          </div>
        </div>
      )}

      {/* 历史记录 Tab */}
      {activeTab === 'history' && (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* 过滤栏 */}
          <div className="flex items-center gap-3">
            <Select
              value={String(historyAssetId)}
              onValueChange={v => setHistoryAssetId(Number(v))}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">所有资产</SelectItem>
                {serverAssets.map(a => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {`${a.name} (${(a.ext_config?.['host'] as string) ?? ''})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleHistoryLoad}
              disabled={loading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>

          {/* 历史表格 */}
          <div className="flex-1 overflow-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0">
                <tr>
                  <th className="w-8 px-3 py-2.5" />
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">状态</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">资产</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">命令</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">操作人</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">耗时</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">时间</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {executions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">
                      暂无执行记录
                    </td>
                  </tr>
                ) : (
                  executions.map(exec => (
                    <HistoryRow
                      key={exec.id}
                      exec={exec}
                      onView={handleViewExecution}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 危险命令确认 */}
      {dangerCommand && (
        <DangerConfirm
          command={dangerCommand}
          onConfirm={() => {
            setDangerCommand(null)
            handleExecute(true)
          }}
          onCancel={() => {
            setDangerCommand(null)
            setExecuting(false)
          }}
        />
      )}
    </div>
  )
}

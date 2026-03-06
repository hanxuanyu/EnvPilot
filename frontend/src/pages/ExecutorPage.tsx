// ExecutorPage.tsx  SSH 命令执行页面（Task 3.2/3.3/3.4/3.7/3.8）
import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Terminal, Play, AlertTriangle, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronRight, RefreshCw, Layers, Server
} from 'lucide-react'
import { executorService, type Execution } from '@/services/executorService'
import { useExecutorStore } from '@/store/executorStore'
import { useAssetStore } from '@/store/assetStore'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

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
    case 'success':     return <CheckCircle className="w-4 h-4 text-emerald-400" />
    case 'failed':      return <XCircle className="w-4 h-4 text-red-400" />
    case 'running':     return <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
    case 'interrupted': return <AlertTriangle className="w-4 h-4 text-yellow-400" />
    default:            return <Clock className="w-4 h-4 text-muted-foreground" />
  }
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
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
          >
            确认强制执行
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 执行输出展示 ──────────────────────────────────────────────
interface OutputPanelProps {
  execId: number | null
  output: string
  status: string
  isLive: boolean
}
function OutputPanel({ execId, output, status, isLive }: OutputPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [output])

  if (!execId) {
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
    <div className="flex-1 flex flex-col bg-[#0a0d14] rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          {statusIcon(status)}
          <span className={`text-xs font-medium ${statusColor(status)}`}>
            {status === 'running' ? '执行中' : status === 'success' ? '执行成功' : status === 'failed' ? '执行失败' : status}
          </span>
          {isLive && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">LIVE</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">Exec #{execId}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
          {output || <span className="text-muted-foreground/50 italic">等待输出...</span>}
        </pre>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ── 历史记录列表 ──────────────────────────────────────────────
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
          <button
            className="text-xs text-primary hover:underline"
            onClick={(e) => { e.stopPropagation(); onView(exec) }}
          >
            查看
          </button>
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
  const { assets, environments, loadEnvironments, loadAssets } = useAssetStore()
  const { executions, outputBuffer, loading, executing, appendOutput, setExecuting, loadExecutions } = useExecutorStore()

  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([])
  const [command, setCommand] = useState('')
  const [currentExecId, setCurrentExecId] = useState<number | null>(null)
  const [currentExecStatus, setCurrentExecStatus] = useState('running')
  const [isLive, setIsLive] = useState(false)
  const [dangerCommand, setDangerCommand] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'execute' | 'history'>('execute')
  const [historyAssetId, setHistoryAssetId] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)

  // 只显示 server 类型资产
  const serverAssets = assets.filter(a => a.type === 'server')

  useEffect(() => {
    loadEnvironments()
    loadAssets()
    loadExecutions({ page: 1, page_size: 20 })
  }, [])

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

      if (selectedAssetIds.length === 1) {
        // 单资产执行
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
          const execId = result.execution.id
          setCurrentExecId(execId)
          setCurrentExecStatus('running')
          setIsLive(true)
          setActiveTab('execute')

          executorService.onOutput(execId, (chunk) => appendOutput(execId, chunk))
          executorService.onDone(execId, (data) => {
            setCurrentExecStatus(data.status)
            setIsLive(false)
            executorService.offOutput(execId)
            executorService.offDone(execId)
            loadExecutions({ asset_id: historyAssetId, page: historyPage })
          })
        }
      } else {
        // 批量执行
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

        toast.success(`已向 ${selectedAssetIds.length} 台服务器发起执行`)
        result.results.forEach(r => {
          if (r.execution) {
            const execId = r.execution.id
            executorService.onOutput(execId, (chunk) => appendOutput(execId, chunk))
            executorService.onDone(execId, () => {
              executorService.offOutput(execId)
              executorService.offDone(execId)
            })
          }
        })
        loadExecutions({ page: historyPage })
        setExecuting(false)
      }
    } catch (e: any) {
      toast.error(e.message)
      setExecuting(false)
    }
  }, [selectedAssetIds, command, historyAssetId, historyPage])

  const toggleAsset = (id: number) => {
    setSelectedAssetIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleHistoryLoad = async () => {
    await loadExecutions({ asset_id: historyAssetId, page: historyPage, page_size: 20 })
  }

  const currentOutput = currentExecId ? (outputBuffer[currentExecId] ?? '') : ''

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">命令执行</h1>
        <p className="text-sm text-muted-foreground mt-1">SSH 命令执行 · 支持单台 / 批量 · 实时输出</p>
      </div>

      {/* 标签页 */}
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
                      <div className="text-xs text-muted-foreground truncate">{asset.host}:{asset.port}</div>
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

          {/* 右侧：命令输入 + 输出 */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            {/* 命令输入区 */}
            <div className="bg-card border border-border rounded-xl p-4">
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                SSH 命令
              </label>
              <textarea
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
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-2 flex-wrap">
                  {['uptime', 'df -h', 'free -m', 'top -bn1 | head -20', 'systemctl status nginx'].map(cmd => (
                    <button
                      key={cmd}
                      onClick={() => setCommand(cmd)}
                      className="text-xs px-2 py-1 rounded bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-mono"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handleExecute()}
                  disabled={executing || selectedAssetIds.length === 0 || !command.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                >
                  {executing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {selectedAssetIds.length > 1 ? `批量执行 (${selectedAssetIds.length})` : '执行'}
                </button>
              </div>
            </div>

            {/* 输出面板 */}
            <OutputPanel
              execId={currentExecId}
              output={currentOutput}
              status={currentExecStatus}
              isLive={isLive}
            />
          </div>
        </div>
      )}

      {/* 历史记录 Tab */}
      {activeTab === 'history' && (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* 过滤栏 */}
          <div className="flex items-center gap-3">
            <select
              value={historyAssetId}
              onChange={e => setHistoryAssetId(Number(e.target.value))}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value={0}>所有资产</option>
              {serverAssets.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.host})</option>
              ))}
            </select>
            <button
              onClick={handleHistoryLoad}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
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
                      onView={(e) => {
                        setCurrentExecId(e.id)
                        setCurrentExecStatus(e.status)
                        setIsLive(false)
                        setActiveTab('execute')
                      }}
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

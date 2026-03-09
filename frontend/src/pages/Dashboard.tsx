import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Cpu,
  HardDrive,
  Layers3,
  LoaderCircle,
  PlayCircle,
  Server,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare,
  Workflow,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { assetService, environmentService } from '@/services/assetService'
import { auditService } from '@/services/auditService'
import { getHostInfo, getVersion, ping, type HostInfo, type VersionInfo } from '@/services/backendService'
import { executorService, type Execution } from '@/services/executorService'
import { healthService } from '@/services/healthService'
import { IS_SERVER_MODE } from '@/lib/apiClient'
import { CATEGORY_LABELS, getAssetAddress, type Asset, type Environment } from '@/types/asset'
import { HEALTH_STATUS_LABELS, type HealthSnapshot, type HealthSummary } from '@/types/health'
import type { AuditLog } from '@/types/audit'

type BackendStatus = 'checking' | 'ok' | 'error'

const AUTO_REFRESH_MS = 5000

function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

function formatPercent(value: number) {
  return `${Math.round(value || 0)}%`
}

function formatRelativeTime(input?: string) {
  if (!input) return '暂无记录'
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return '暂无记录'
  const delta = Date.now() - date.getTime()
  const minutes = Math.round(delta / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.round(hours / 24)
  return `${days} 天前`
}

function formatUptime(seconds: number) {
  if (!seconds) return '未知'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days} 天 ${hours} 小时`
  if (hours > 0) return `${hours} 小时 ${minutes} 分`
  return `${minutes} 分钟`
}

function formatClockTime(timestamp?: number | null) {
  if (!timestamp) return '尚未同步'
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function healthTone(status: HealthSnapshot['status']) {
  switch (status) {
    case 'healthy':
      return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    case 'warning':
      return 'text-amber-500 bg-amber-500/10 border-amber-500/20'
    case 'critical':
    case 'unreachable':
      return 'text-rose-500 bg-rose-500/10 border-rose-500/20'
    default:
      return 'text-muted-foreground bg-muted/40 border-border'
  }
}

export default function Dashboard() {
  const activeRef = useRef(true)
  const liveRefreshRef = useRef(false)
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking')
  const [backendLatency, setBackendLatency] = useState<number | null>(null)
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [hostInfo, setHostInfo] = useState<HostInfo | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [environmentCount, setEnvironmentCount] = useState(0)
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null)
  const [recentHealth, setRecentHealth] = useState<HealthSnapshot[]>([])
  const [recentAudits, setRecentAudits] = useState<AuditLog[]>([])
  const [recentExecutions, setRecentExecutions] = useState<Execution[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [executionTotal, setExecutionTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)

  const loadStaticData = async () => {
    const [version, assetList, environments] = await Promise.all([
      getVersion(),
      assetService.list() as Promise<Asset[]>,
      environmentService.list() as Promise<Environment[]>,
    ])

    if (!activeRef.current) return
    setVersionInfo(version)
    setAssets(assetList)
    setEnvironmentCount(environments.length)
  }

  const loadLiveData = async (silent = false) => {
    if (liveRefreshRef.current) return
    liveRefreshRef.current = true

    const startAt = performance.now()
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const pong = await ping()
      if (pong !== 'pong') throw new Error('后端不可用')

      const [host, summary, snapshots, audits, executions] = await Promise.all([
        getHostInfo(),
        healthService.getSummary(),
        healthService.listSnapshots({ limit: 8, offset: 0 }),
        auditService.list({ limit: 6, offset: 0 }),
        executorService.listExecutions({ page: 1, page_size: 6 }),
      ])

      if (!activeRef.current) return

      setBackendStatus('ok')
      setBackendLatency(Math.max(1, Math.round(performance.now() - startAt)))
      setHostInfo(host)
      setHealthSummary(summary)
      setRecentHealth(snapshots.items)
      setRecentAudits(audits.items)
      setAuditTotal(audits.total)
      setRecentExecutions(executions.list)
      setExecutionTotal(executions.total)
      setLastUpdatedAt(Date.now())
    } catch {
      if (!activeRef.current) return
      setBackendStatus('error')
    } finally {
      liveRefreshRef.current = false
      if (!activeRef.current) return
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    activeRef.current = true

    const bootstrap = async () => {
      setBackendStatus('checking')
      await Promise.allSettled([loadStaticData(), loadLiveData(false)])
    }

    void bootstrap()

    const timer = window.setInterval(() => {
      void loadLiveData(true)
    }, AUTO_REFRESH_MS)

    return () => {
      activeRef.current = false
      window.clearInterval(timer)
    }
  }, [])

  const handleManualRefresh = async () => {
    await Promise.allSettled([loadStaticData(), loadLiveData(true)])
  }

  const serverAssets = assets.filter((asset) => asset.category === 'server')
  const middlewareAssets = assets.filter((asset) => asset.category !== 'server')
  const healthyRate = healthSummary?.total ? Math.round(((healthSummary.healthy ?? 0) / healthSummary.total) * 100) : 0
  const abnormalAssetCount = (healthSummary?.warning ?? 0) + (healthSummary?.critical ?? 0) + (healthSummary?.unreachable ?? 0)
  const issueAssets = recentHealth.filter((item) => item.status !== 'healthy').slice(0, 4)
  const newestAsset = [...assets].sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))[0]
  const latestAudit = recentAudits[0]
  const latestExecution = recentExecutions[0]
  const runningExecutions = recentExecutions.filter((item) => item.status === 'running').length

  const heroSignals = useMemo(() => ([
    {
      title: '后端 RTT',
      value: backendLatency ? `${backendLatency} ms` : backendStatus === 'error' ? '异常' : '检测中',
      detail: backendStatus === 'ok' ? '链路可用' : backendStatus === 'error' ? '请检查服务端状态' : '正在同步',
      icon: Activity,
      tone: backendStatus === 'ok' ? 'text-emerald-500' : backendStatus === 'error' ? 'text-rose-500' : 'text-muted-foreground',
    },
    {
      title: '待处理异常',
      value: String(abnormalAssetCount),
      detail: abnormalAssetCount > 0 ? '建议优先查看健康面板' : '当前没有异常资产',
      icon: ShieldAlert,
      tone: abnormalAssetCount > 0 ? 'text-amber-500' : 'text-emerald-500',
    },
    {
      title: '运行中执行',
      value: String(runningExecutions),
      detail: latestExecution ? `最近 ${formatRelativeTime(executionsafeTime(latestExecution))}` : '暂无执行任务',
      icon: PlayCircle,
      tone: runningExecutions > 0 ? 'text-sky-500' : 'text-muted-foreground',
    },
    {
      title: '最近审计',
      value: latestAudit ? formatRelativeTime(latestAudit.created_at) : '暂无',
      detail: latestAudit ? `${latestAudit.module} / ${latestAudit.action}` : '等待新的审计记录',
      icon: ClipboardList,
      tone: 'text-violet-500',
    },
  ]), [abnormalAssetCount, backendLatency, backendStatus, latestAudit, latestExecution, runningExecutions])

  const statCards = [
    { title: '资产总量', value: String(assets.length), detail: `${serverAssets.length} 台服务器 / ${middlewareAssets.length} 个中间件`, icon: Server, tone: 'text-sky-500' },
    { title: '环境数量', value: String(environmentCount), detail: newestAsset ? `最近变更：${newestAsset.name}` : '尚未创建资产', icon: Layers3, tone: 'text-violet-500' },
    { title: '健康资产', value: healthSummary ? `${healthSummary.healthy}/${healthSummary.total}` : '0/0', detail: healthSummary?.total ? `健康率 ${healthyRate}%` : '等待首次健康检查', icon: Activity, tone: 'text-emerald-500' },
    { title: '异常资产', value: String(abnormalAssetCount), detail: abnormalAssetCount > 0 ? '包含告警、严重和不可达' : '当前无异常', icon: AlertTriangle, tone: abnormalAssetCount > 0 ? 'text-amber-500' : 'text-emerald-500' },
    { title: '审计记录', value: String(auditTotal), detail: latestAudit ? `最近 ${formatRelativeTime(latestAudit.created_at)}` : '暂无审计日志', icon: ClipboardList, tone: 'text-amber-500' },
    { title: '命令执行', value: String(executionTotal), detail: latestExecution ? `最近执行 ${formatRelativeTime(executionsafeTime(latestExecution))}` : '暂无执行记录', icon: TerminalSquare, tone: 'text-rose-500' },
  ]

  const quickActions = [
    {
      to: '/assets',
      title: '资产台账',
      description: `${assets.length} 项资产，最近变更 ${newestAsset?.name ?? '暂无'}`,
      meta: `${serverAssets.length} 台服务器`,
      icon: Server,
    },
    {
      to: '/health',
      title: '健康面板',
      description: abnormalAssetCount > 0 ? `${abnormalAssetCount} 个异常节点等待处理` : '全部资产状态稳定',
      meta: `健康率 ${healthyRate}%`,
      icon: ShieldCheck,
    },
    {
      to: '/executor',
      title: '执行台',
      description: latestExecution ? `最近命令：${latestExecution.command}` : '适合批量执行与审计联动',
      meta: `${executionTotal} 条记录`,
      icon: TerminalSquare,
    },
    {
      to: '/config',
      title: '配置中心',
      description: `版本 ${versionInfo?.version ?? 'dev'} · ${versionInfo?.commit?.slice(0, 7) ?? 'unknown'}`,
      meta: '快照 / 回滚 / 热更新',
      icon: Workflow,
    },
  ]

  return (
    <div className="space-y-6" style={{ animation: 'var(--animate-fade-in)' }}>
      <section>
        <div
          className="rounded-2xl border p-6"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 18%, var(--color-card)) 0%, var(--color-card) 58%, color-mix(in srgb, var(--color-secondary) 66%, var(--color-card)) 100%)',
            borderColor: 'color-mix(in srgb, var(--color-primary) 18%, var(--color-border))',
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-card) 82%, transparent)',
                  borderColor: 'var(--color-border)',
                  color: backendStatus === 'ok' ? '#10b981' : backendStatus === 'error' ? '#ef4444' : 'var(--color-muted-foreground)',
                }}
              >
                {backendStatus === 'checking' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : backendStatus === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                <span>{backendStatus === 'checking' ? '正在同步后端状态' : backendStatus === 'ok' ? '后端已连接' : '后端未连接'}</span>
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-foreground)' }}>
                  EnvPilot 运行概览
                </h1>
                <p className="mt-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                  关键运行信号、基础资源与最近运维活动会每 {AUTO_REFRESH_MS / 1000} 秒自动刷新一次。
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'color-mix(in srgb, var(--color-card) 85%, transparent)',
                  color: 'var(--color-muted-foreground)',
                }}
              >
                <Clock3 className={`h-3.5 w-3.5 ${refreshing ? 'animate-pulse' : ''}`} />
                <span>{refreshing ? '刷新中' : `已同步 ${formatClockTime(lastUpdatedAt)}`}</span>
              </span>
              <Button variant="outline" size="sm" onClick={handleManualRefresh} loading={refreshing}>
                立即刷新
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {heroSignals.map((signal) => (
              <div
                key={signal.title}
                className="rounded-2xl border px-4 py-3"
                style={{
                  borderColor: 'color-mix(in srgb, var(--color-primary) 14%, var(--color-border))',
                  backgroundColor: 'color-mix(in srgb, var(--color-card) 82%, transparent)',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{signal.title}</span>
                  <signal.icon className={`h-4 w-4 ${signal.tone}`} />
                </div>
                <div className="mt-3 text-xl font-semibold" style={{ color: 'var(--color-foreground)' }}>{signal.value}</div>
                <div className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted-foreground)' }}>{signal.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="grid min-w-[220px] gap-2 rounded-2xl border p-4 text-sm" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
          <InfoRow label="版本" value={versionInfo?.version ?? 'dev'} />
          <InfoRow label="Commit" value={versionInfo?.commit ?? 'unknown'} mono />
          <InfoRow label="主机" value={hostInfo?.hostname || '未知主机'} />
          <InfoRow label="平台" value={hostInfo ? `${hostInfo.platform} / ${hostInfo.architecture}` : '—'} />
          <InfoRow label="模式" value={IS_SERVER_MODE ? 'Server' : 'Desktop'} />
          <InfoRow label="后端 RTT" value={backendLatency ? `${backendLatency} ms` : '—'} />
          <InfoRow label="最近同步" value={formatClockTime(lastUpdatedAt)} />
          <InfoRow label="最近审计" value={latestAudit ? `${latestAudit.module}/${latestAudit.action}` : '暂无'} />
        </div>

        <Panel
          title="主机资源"
          extra={<LiveTag text={refreshing ? '同步中' : hostInfo ? `${hostInfo.platform} ${hostInfo.platform_version}` : '加载中'} active={refreshing} />}
        >
          <div className="space-y-4">
            {[
              { key: 'cpu', label: 'CPU', icon: Cpu, value: formatPercent(hostInfo?.cpu_percent ?? 0), percent: hostInfo?.cpu_percent ?? 0, detail: `${hostInfo?.cpu_cores ?? 0} 核` },
              { key: 'memory', label: '内存', icon: Activity, value: formatPercent(hostInfo?.memory_percent ?? 0), percent: hostInfo?.memory_percent ?? 0, detail: `${formatBytes(hostInfo?.memory_used ?? 0)} / ${formatBytes(hostInfo?.memory_total ?? 0)}` },
              { key: 'disk', label: '磁盘', icon: HardDrive, value: formatPercent(hostInfo?.disk_percent ?? 0), percent: hostInfo?.disk_percent ?? 0, detail: `${formatBytes(hostInfo?.disk_used ?? 0)} / ${formatBytes(hostInfo?.disk_total ?? 0)}` },
            ].map((item) => (
              <div key={item.key} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                    <span style={{ color: 'var(--color-foreground)' }}>{item.label}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium" style={{ color: 'var(--color-foreground)' }}>{item.value}</div>
                    <div className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>{item.detail}</div>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full" style={{ width: `${Math.max(6, Math.min(100, item.percent))}%`, background: 'linear-gradient(90deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 60%, white 40%))' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
            <div>启动时长：{formatUptime(hostInfo?.uptime_seconds ?? 0)}</div>
            <div className="truncate">应用位置：{hostInfo?.executable ?? '未知'}</div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {statCards.map((card) => (
          <div key={card.title} className="rounded-2xl border p-4" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{card.title}</span>
              <card.icon className={`h-4 w-4 ${card.tone}`} />
            </div>
            <div className="mt-3 text-2xl font-semibold" style={{ color: 'var(--color-foreground)' }}>{card.value}</div>
            <div className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted-foreground)' }}>{card.detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-4">
          <Panel title="资产分布" action={{ to: '/assets', label: '查看资产' }}>
            <div className="grid gap-3 md:grid-cols-2">
              {(['server', 'database', 'cache', 'mq', 'other'] as const).map((category) => {
                const count = assets.filter((asset) => asset.category === category).length
                const percent = assets.length ? Math.round((count / assets.length) * 100) : 0
                return (
                  <div key={category} className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: 'var(--color-foreground)' }}>{CATEGORY_LABELS[category]}</span>
                      <span style={{ color: 'var(--color-muted-foreground)' }}>{count} 个</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full" style={{ width: `${Math.max(percent, count > 0 ? 8 : 0)}%`, backgroundColor: 'var(--color-primary)' }} />
                    </div>
                    <div className="mt-2 text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>{percent}% 占比</div>
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel title="最近审计" action={{ to: '/audit', label: '进入审计' }}>
            <div className="space-y-3">
              {loading && recentAudits.length === 0 ? <StackSkeleton rows={3} /> : recentAudits.length > 0 ? recentAudits.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 rounded-xl border px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                      <span>{item.module}</span>
                      <span className="text-muted-foreground">/</span>
                      <span>{item.action}</span>
                    </div>
                    <div className="mt-1 truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{item.resource_name || item.detail || '无附加说明'}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className={item.success ? 'text-emerald-500' : 'text-rose-500'}>{item.success ? '成功' : '失败'}</div>
                    <div style={{ color: 'var(--color-muted-foreground)' }}>{formatRelativeTime(item.created_at)}</div>
                  </div>
                </div>
              )) : <EmptyState text="暂无审计数据" />}
            </div>
          </Panel>
        </div>

        <div className="grid gap-4">
          <Panel title="快速入口" extra={<LiveTag text={refreshing ? '同步中' : '就绪'} active={refreshing} />}>
            {loading && assets.length === 0 ? (
              <GridSkeleton count={4} />
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {quickActions.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="group rounded-2xl border p-3 transition-all hover:-translate-y-0.5"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--color-secondary) 24%, transparent)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: 'var(--color-primary)' }}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <span className="rounded-full px-2 py-1 text-[10px]" style={{ backgroundColor: 'color-mix(in srgb, var(--color-card) 65%, transparent)', color: 'var(--color-muted-foreground)' }}>
                        {item.meta}
                      </span>
                    </div>
                    <div className="mt-3 text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>{item.title}</div>
                    <div className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted-foreground)' }}>{item.description}</div>
                    <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--color-primary)' }}>
                      <span>进入模块</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="健康关注" action={{ to: '/health', label: '查看详情' }}>
            <div className="space-y-3">
              {loading && recentHealth.length === 0 ? <StackSkeleton rows={3} /> : (issueAssets.length > 0 ? issueAssets : recentHealth.slice(0, 4)).map((item) => (
                <div key={item.id} className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>{item.asset?.name ?? `资产 #${item.asset_id}`}</div>
                      <div className="mt-1 truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{item.asset ? getAssetAddress(item.asset) : item.detail || '暂无地址'}</div>
                    </div>
                    <div className={`rounded-full border px-2 py-1 text-[11px] ${healthTone(item.status)}`}>{HEALTH_STATUS_LABELS[item.status]}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                    <span className="truncate">{item.detail || '无附加信息'}</span>
                    <span className="shrink-0">{formatRelativeTime(item.checked_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="最近执行" action={{ to: '/executor', label: '打开执行台' }}>
            <div className="space-y-3">
              {loading && recentExecutions.length === 0 ? <StackSkeleton rows={3} /> : recentExecutions.length > 0 ? recentExecutions.map((execution) => (
                <div key={execution.id} className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>{execution.command}</div>
                      <div className="mt-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>资产 #{execution.asset_id} · {formatRelativeTime(executionsafeTime(execution))}</div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[11px] ${execution.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : execution.status === 'failed' ? 'bg-rose-500/10 text-rose-500' : execution.status === 'running' ? 'bg-sky-500/10 text-sky-500' : 'bg-muted text-muted-foreground'}`}>{execution.status}</span>
                  </div>
                </div>
              )) : <EmptyState text="暂无执行数据" />}
            </div>
          </Panel>
        </div>
      </section>

      {loading && backendStatus === 'checking' ? <div className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>正在同步首页数据…</div> : null}
    </div>
  )
}

function executionsafeTime(execution: Execution) {
  return (execution.created_at as string | undefined) || ''
}

function Panel({
  title,
  children,
  action,
  extra,
}: {
  title: string
  children: React.ReactNode
  action?: { to: string; label: string }
  extra?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border p-5" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>{title}</h2>
        </div>
        {action ? (
          <Button asChild variant="outline" size="sm">
            <Link to={action.to}>{action.label} <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        ) : extra ? extra : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function LiveTag({ text, active }: { text: string; active?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
      style={{
        borderColor: 'var(--color-border)',
        color: 'var(--color-muted-foreground)',
        backgroundColor: 'color-mix(in srgb, var(--color-secondary) 38%, transparent)',
      }}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
      <span>{text}</span>
    </span>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span style={{ color: 'var(--color-muted-foreground)' }}>{label}</span>
      <span className={mono ? 'font-mono text-xs' : 'font-medium'} style={{ color: 'var(--color-foreground)' }}>{value}</span>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border px-4 py-8 text-sm text-center" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>{text}</div>
}

function StackSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
          <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-2.5 w-4/5 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-2.5 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

function GridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl border p-3" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="h-9 w-9 animate-pulse rounded-xl bg-muted" />
            <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-2.5 w-4/5 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-2.5 w-3/5 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

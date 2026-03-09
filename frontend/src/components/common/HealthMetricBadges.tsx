import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { HealthSnapshot } from '@/types/health'
import { HEALTH_STATUS_LABELS } from '@/types/health'

type MetricTone = 'neutral' | 'good' | 'warn'

interface MetricBadgeItem {
  code: string
  value: string
  tone?: MetricTone
}

function formatBytes(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  const digits = size >= 100 || unitIndex === 0 ? 0 : 1
  return `${size.toFixed(digits)}${units[unitIndex]}`
}

function formatUptime(value: unknown) {
  if (typeof value === 'number' && value > 0) {
    const total = Math.floor(value)
    const days = Math.floor(total / 86400)
    const hours = Math.floor((total % 86400) / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    if (days > 0) return `${days}d${hours}h`
    if (hours > 0) return `${hours}h${minutes}m`
    return `${minutes}m`
  }
  if (typeof value === 'string' && value.trim()) return value.trim()
  return ''
}

function formatDateTime(value: string) {
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return value
  return timestamp.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatMetricValue(key: string, value: unknown) {
  if (value === null || value === undefined) return ''
  if (key.includes('bytes') && typeof value === 'number') return formatBytes(value)
  if (key === 'uptime') return formatUptime(value)
  if (Array.isArray(value)) return value.join(' / ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function metricLabel(key: string) {
  const labels: Record<string, string> = {
    load_average: '负载',
    load_ratio_1m: '负载比',
    mem_usage_percent: '内存使用',
    mem_total_bytes: '内存总量',
    disk_usage_percent: '磁盘使用',
    disk_mount: '挂载点',
    uptime: '运行时长',
    database_count: '库数量',
    table_count: '表数量',
    db_size: '键数量',
    partition_count: '分区数量',
    cpu_cores: 'CPU 核心',
    os: '系统',
    hostname: '主机名',
    version: '版本',
  }
  return labels[key] || key
}

function metricToneByPercent(value: string): MetricTone {
  const parsed = Number.parseFloat(value)
  if (Number.isNaN(parsed)) return 'neutral'
  if (parsed >= 85) return 'warn'
  if (parsed <= 60) return 'good'
  return 'neutral'
}

function buildMetricItems(snapshot?: HealthSnapshot | null): MetricBadgeItem[] {
  const metrics = snapshot?.metrics || {}
  const items: MetricBadgeItem[] = []

  if (Array.isArray(metrics.load_average)) {
    const values = metrics.load_average
      .filter((value): value is number => typeof value === 'number')
      .map((value) => value.toFixed(2))
    if (values.length > 0) {
      const ratio = typeof metrics.load_ratio_1m === 'string' ? `/${metrics.load_ratio_1m}` : ''
      items.push({ code: 'CPU', value: `${values[0]}${ratio}` })
    }
  }
  if (typeof metrics.mem_usage_percent === 'string') {
    const total = formatBytes(metrics.mem_total_bytes)
    items.push({ code: 'MEM', value: total ? `${metrics.mem_usage_percent}/${total}` : metrics.mem_usage_percent, tone: metricToneByPercent(metrics.mem_usage_percent) })
  }
  if (typeof metrics.disk_usage_percent === 'string') {
    items.push({ code: 'DSK', value: metrics.disk_usage_percent, tone: metricToneByPercent(metrics.disk_usage_percent) })
  }
  if (typeof metrics.uptime === 'string' || typeof metrics.uptime === 'number') {
    const uptime = formatUptime(metrics.uptime)
    if (uptime) items.push({ code: 'UPT', value: uptime })
  }
  if (typeof metrics.database_count === 'number') {
    items.push({ code: 'DB', value: `${metrics.database_count}` })
  }
  if (typeof metrics.table_count === 'number') {
    items.push({ code: 'TBL', value: `${metrics.table_count}` })
  }
  if (typeof metrics.db_size === 'number') {
    items.push({ code: 'KEY', value: `${metrics.db_size}` })
  }
  if (typeof metrics.partition_count === 'number') {
    items.push({ code: 'PTN', value: `${metrics.partition_count}` })
  }
  if (typeof metrics.cpu_cores === 'number') {
    items.push({ code: 'CORE', value: `${metrics.cpu_cores}` })
  }

  return items.slice(0, 6)
}

function toneClass(tone: MetricTone = 'neutral') {
  if (tone === 'good') return 'border-emerald-500/25 bg-emerald-500/8 text-emerald-100'
  if (tone === 'warn') return 'border-amber-500/30 bg-amber-500/10 text-amber-50'
  return 'border-border/80 bg-background/40 text-foreground'
}

export function HealthMetricBadges({
  snapshot,
  emptyText = '—',
  className = '',
}: {
  snapshot?: HealthSnapshot | null
  emptyText?: string
  className?: string
}) {
  const items = buildMetricItems(snapshot)
  const metrics = Object.entries(snapshot?.metrics || {})
    .map(([key, value]) => ({ key, label: metricLabel(key), value: formatMetricValue(key, value) }))
    .filter((entry) => entry.value)

  if (items.length === 0) {
    return <span className="text-[11px] text-muted-foreground">{emptyText}</span>
  }

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap ${className}`}>
            {items.map((item) => (
              <Badge
                key={`${item.code}-${item.value}`}
                variant="outline"
                className={`inline-flex h-6 items-center gap-1 rounded-md px-1.5 py-0 text-[10px] font-medium ${toneClass(item.tone)}`}
              >
                <span className="text-muted-foreground/90">{item.code}</span>
                <span className="max-w-24 truncate text-foreground">{item.value}</span>
              </Badge>
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent align="start" className="w-80 space-y-2">
          <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-2">
            <span className="text-[11px] font-medium text-foreground">{HEALTH_STATUS_LABELS[snapshot?.status || 'unknown']}</span>
            {snapshot?.latency_ms ? (
              <span className="text-[11px] text-muted-foreground">{snapshot.latency_ms} ms</span>
            ) : null}
          </div>
          {snapshot?.detail ? (
            <div className="text-[11px] leading-5 text-muted-foreground">{snapshot.detail}</div>
          ) : null}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] leading-5">
            <span className="text-muted-foreground">检查类型</span>
            <span className="text-right text-foreground">{snapshot?.check_type || '—'}</span>
            <span className="text-muted-foreground">检查时间</span>
            <span className="text-right text-foreground">{snapshot?.checked_at ? formatDateTime(snapshot.checked_at) : '—'}</span>
          </div>
          {metrics.length > 0 ? (
            <div className="space-y-1 border-t border-border/80 pt-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">metrics</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] leading-5">
                {metrics.map((entry) => (
                  <>
                    <span key={`${entry.key}-label`} className="text-muted-foreground">{entry.label}</span>
                    <span key={`${entry.key}-value`} className="truncate text-right text-foreground">{entry.value}</span>
                  </>
                ))}
              </div>
            </div>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
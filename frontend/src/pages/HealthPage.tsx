import { useEffect, useState } from 'react'
import { Activity, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { HealthMetricBadges } from '@/components/common/HealthMetricBadges'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { environmentService } from '@/services/assetService'
import { healthService } from '@/services/healthService'
import type { Environment, AssetCategory } from '@/types/asset'
import { CATEGORY_LABELS } from '@/types/asset'
import type { HealthSnapshot, HealthStatus, HealthSummary } from '@/types/health'
import { HEALTH_STATUS_LABELS } from '@/types/health'

const PAGE_SIZE_OPTIONS = [20, 50, 100]

function statusVariant(status: HealthStatus): 'secondary' | 'destructive' | 'outline' {
  if (status === 'healthy') return 'secondary'
  if (status === 'critical' || status === 'unreachable') return 'destructive'
  return 'outline'
}

function formatCheckType(checkType: string) {
  const mapping: Record<string, string> = {
    ssh_metrics: 'SSH',
    connector_probe: 'PROBE',
    connector_ping: 'PING',
    tcp_port: 'TCP',
  }
  return mapping[checkType] || checkType.toUpperCase()
}

export default function HealthPage() {
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [snapshots, setSnapshots] = useState<HealthSnapshot[]>([])
  const [summary, setSummary] = useState<HealthSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [selectedEnv, setSelectedEnv] = useState<number | 'all'>('all')
  const [category, setCategory] = useState<AssetCategory | ''>('')
  const [status, setStatus] = useState<HealthStatus | ''>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const selectedEnvId = selectedEnv === 'all' ? undefined : selectedEnv
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const query = {
    environment_id: selectedEnvId,
    category: category || undefined,
    status: status || undefined,
    keyword: appliedKeyword || undefined,
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [summaryResult, listResult] = await Promise.all([
        healthService.getSummary(query),
        healthService.listSnapshots({
          ...query,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
      ])
      setSummary(summaryResult)
      setSnapshots(listResult.items)
      setTotal(listResult.total)
    } catch (error: any) {
      toast.error('加载健康检查数据失败', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    environmentService.list()
      .then((list) => setEnvironments(list as Environment[]))
      .catch((error: any) => toast.error('加载环境失败', { description: error.message }))
  }, [])

  useEffect(() => {
    loadData()
  }, [selectedEnv, category, status, appliedKeyword, page, pageSize])

  const handleSearch = async () => {
    const nextKeyword = keyword.trim()
    const changed = nextKeyword !== appliedKeyword
    setAppliedKeyword(nextKeyword)
    if (page !== 1) {
      setPage(1)
      return
    }
    if (!changed) {
      await loadData()
    }
  }

  const handleCheckAll = async () => {
    setChecking(true)
    try {
      const result = await healthService.checkAll({
        environment_id: selectedEnvId,
        category: category || undefined,
      })
      toast.success(`已完成 ${result.checked} 个资产的健康检查`)
      await loadData()
    } catch (error: any) {
      toast.error('批量健康检查失败', { description: error.message })
    } finally {
      setChecking(false)
    }
  }

  const handleCheckAsset = async (assetId: number) => {
    try {
      await healthService.checkAsset(assetId)
      toast.success('资产健康检查完成')
      await loadData()
    } catch (error: any) {
      toast.error('资产健康检查失败', { description: error.message })
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in-0 duration-200">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">健康检查</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            支持自动周期检查，也可以手动触发当前范围或单资产重检，并查看最新指标快照。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={handleCheckAll} loading={checking}>检查当前范围</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">总资产</div><div className="mt-2 text-2xl font-semibold text-foreground">{summary?.total ?? 0}</div></div>
        <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">健康</div><div className="mt-2 text-2xl font-semibold text-emerald-500">{summary?.healthy ?? 0}</div></div>
        <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">告警</div><div className="mt-2 text-2xl font-semibold text-amber-500">{summary?.warning ?? 0}</div></div>
        <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">严重</div><div className="mt-2 text-2xl font-semibold text-red-500">{summary?.critical ?? 0}</div></div>
        <div className="rounded-xl border border-border bg-card p-4"><div className="text-xs text-muted-foreground">不可达</div><div className="mt-2 text-2xl font-semibold text-rose-500">{summary?.unreachable ?? 0}</div></div>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 lg:grid-cols-[180px_180px_180px_minmax(0,1fr)_120px]">
        <Select value={selectedEnv === 'all' ? '__all__' : String(selectedEnv)} onValueChange={(value) => {
          setSelectedEnv(value === '__all__' ? 'all' : Number(value))
          setPage(1)
        }}>
          <SelectTrigger><SelectValue placeholder="全部环境" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部环境</SelectItem>
            {environments.map((env) => <SelectItem key={env.id} value={String(env.id)}>{env.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={category || '__all__'} onValueChange={(value) => {
          setCategory(value === '__all__' ? '' : value as AssetCategory)
          setPage(1)
        }}>
          <SelectTrigger><SelectValue placeholder="全部类别" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部类别</SelectItem>
            {(Object.entries(CATEGORY_LABELS) as [AssetCategory, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status || '__all__'} onValueChange={(value) => {
          setStatus(value === '__all__' ? '' : value as HealthStatus)
          setPage(1)
        }}>
          <SelectTrigger><SelectValue placeholder="全部状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部状态</SelectItem>
            {(Object.entries(HEALTH_STATUS_LABELS) as [HealthStatus, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 rounded-md border border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索资产名称"
            className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <Button onClick={handleSearch} loading={loading}>查询</Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">共 {total} 条最新健康快照</span>
          <span className="text-muted-foreground">第 {page} / {totalPages} 页</span>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-secondary/60 border-b border-border">
                {['资产', '环境', '检查', '状态', 'RTT', '指标', '时间', '操作'].map((header) => (
                  <th key={header} className="px-3 py-2.5 text-left text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshots.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-foreground">当前没有健康快照，请先执行检查。</td>
                </tr>
              ) : snapshots.map((snapshot) => (
                <tr key={snapshot.id} className="border-t border-border align-middle">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2 font-medium text-foreground"><Activity className="h-4 w-4 text-primary" />{snapshot.asset?.name || `资产 #${snapshot.asset_id}`}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{snapshot.asset?.plugin_type || '—'}</div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{snapshot.asset?.environment?.name || '—'}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="text-[10px] tracking-[0.16em]">{formatCheckType(snapshot.check_type)}</Badge>
                  </td>
                  <td className="px-3 py-2.5"><Badge variant={statusVariant(snapshot.status)}>{HEALTH_STATUS_LABELS[snapshot.status]}</Badge></td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{snapshot.latency_ms}ms</td>
                  <td className="px-3 py-2.5">
                    <HealthMetricBadges snapshot={snapshot} />
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">{new Date(snapshot.checked_at).toLocaleString('zh-CN')}</td>
                  <td className="px-3 py-2.5"><Button variant="outline" size="sm" onClick={() => handleCheckAsset(snapshot.asset_id)}>重检</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>每页</span>
            <Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1) }}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => <SelectItem key={size} value={String(size)}>{size} 条</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>上一页</Button>
            <span className="min-w-24 text-center text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>下一页</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

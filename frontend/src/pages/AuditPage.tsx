import { useEffect, useState } from 'react'
import { RefreshCw, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/common/AuthProvider'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { auditService } from '@/services/auditService'
import { configService } from '@/services/configService'
import type { AuditLog } from '@/types/audit'
import type { AuditSection } from '@/types/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

const PAGE_SIZE_OPTIONS = [20, 50, 100]
const DEFAULT_AUDIT_POLICY: AuditSection = {
  auto_cleanup: true,
  retention_days: 90,
  max_records: 50000,
  cleanup_interval_hours: 24,
}

const MODULE_OPTIONS = [
  { value: '__all__', label: '全部模块' },
  { value: 'asset', label: '资产管理' },
  { value: 'connector', label: '中间件连接器' },
  { value: 'audit', label: '审计管理' },
]

const STATUS_OPTIONS = [
  { value: '__all__', label: '全部状态' },
  { value: 'true', label: '成功' },
  { value: 'false', label: '失败' },
]

function parseJSONPreview(input?: string): string {
  if (!input) return '—'
  try {
    return JSON.stringify(JSON.parse(input), null, 2)
  } catch {
    return input
  }
}

export default function AuditPage() {
  const { isReadOnly } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [moduleFilter, setModuleFilter] = useState('__all__')
  const [statusFilter, setStatusFilter] = useState('__all__')
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [auditPolicy, setAuditPolicy] = useState<AuditSection>(DEFAULT_AUDIT_POLICY)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const loadAuditPolicy = async () => {
    try {
      const result = await configService.getCurrent()
      setAuditPolicy(result.config.audit ?? DEFAULT_AUDIT_POLICY)
    } catch (error: any) {
      toast.error('加载审计清理策略失败', { description: error.message })
    }
  }

  const loadLogs = async () => {
    setLoading(true)
    try {
      const result = await auditService.list({
        module: moduleFilter === '__all__' ? undefined : moduleFilter,
        success: statusFilter === '__all__' ? undefined : statusFilter === 'true',
        keyword: appliedKeyword || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      setLogs(result.items)
      setTotal(result.total)
    } catch (error: any) {
      toast.error('加载审计日志失败', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadLogs()
  }, [page, pageSize, appliedKeyword, moduleFilter, statusFilter])

  useEffect(() => {
    void loadAuditPolicy()
  }, [])

  const handleSearch = async () => {
    const nextKeyword = keyword.trim()
    const changed = nextKeyword !== appliedKeyword
    setAppliedKeyword(nextKeyword)
    if (page !== 1) {
      setPage(1)
      return
    }
    if (!changed) {
      await loadLogs()
    }
  }

  const handleCleanup = async () => {
    try {
      const result = await auditService.cleanup()
      const deleted = result.deleted_total.toLocaleString('zh-CN')
      const remaining = result.total_after.toLocaleString('zh-CN')
      toast.success('审计日志清理完成', {
        description: result.deleted_total > 0
          ? `已删除 ${deleted} 条，当前保留 ${remaining} 条。`
          : `没有命中过期或超量记录，当前保留 ${remaining} 条。`,
      })
      if (page !== 1) {
        setPage(1)
      } else {
        await loadLogs()
      }
    } catch (error: any) {
      toast.error('清理审计日志失败', { description: error.message })
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5 animate-in fade-in-0 duration-200">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">操作审计</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            统一查看资产变更、凭据操作和中间件连接行为，便于回溯问题与追踪接入过程。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { void loadLogs(); void loadAuditPolicy() }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新审计
          </Button>
          {!isReadOnly ? (
            <ConfirmDialog
              title="立即清理审计日志"
              description={`将立即删除超过 ${auditPolicy.retention_days} 天的历史审计，并在剩余记录中仅保留最新 ${auditPolicy.max_records.toLocaleString('zh-CN')} 条。此操作不可撤销。`}
              confirmText="立即清理"
              danger
              onConfirm={handleCleanup}
            >
              <Button variant="outline" disabled={loading}>
                <Trash2 className="h-4 w-4" />
                立即清理
              </Button>
            </ConfirmDialog>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
        当前默认保留最近 {auditPolicy.retention_days} 天，且最多保留 {auditPolicy.max_records.toLocaleString('zh-CN')} 条审计日志；自动清理 {auditPolicy.auto_cleanup ? `已启用，每 ${auditPolicy.cleanup_interval_hours} 小时执行一次。` : '已关闭。'} 手动清理会立即执行当前策略。
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card p-3.5">
        <div className="w-full sm:w-[170px] lg:w-[180px]">
          <Select value={moduleFilter} onValueChange={(value) => {
            setModuleFilter(value)
            setPage(1)
          }}>
            <SelectTrigger><SelectValue placeholder="模块" /></SelectTrigger>
            <SelectContent>
              {MODULE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-[170px] lg:w-[180px]">
          <Select value={statusFilter} onValueChange={(value) => {
            setStatusFilter(value)
            setPage(1)
          }}>
            <SelectTrigger><SelectValue placeholder="状态" /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-[240px] flex-1 basis-[320px] items-center gap-2 rounded-md border border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
            placeholder="搜索资源名、错误信息或结果摘要"
            className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <Button onClick={() => void handleSearch()} loading={loading} className="w-full sm:w-auto shrink-0">查询</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">共 {total} 条审计记录</span>
          <span className="text-muted-foreground">第 {page} / {totalPages} 页，当前 {logs.length} 条</span>
        </div>
        <div className="overflow-auto">
          <table className="min-w-[1280px] w-full text-sm">
            <thead>
              <tr className="bg-secondary/60 border-b border-border">
                {['时间', '模块', '动作', '资源', '状态', '详情', '请求/结果摘要'].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-sm text-muted-foreground">
                    当前没有匹配的审计记录
                  </td>
                </tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{new Date(log.created_at).toLocaleString('zh-CN')}</td>
                  <td className="px-4 py-3 text-foreground">{log.module}</td>
                  <td className="px-4 py-3 text-foreground">{log.action}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{log.resource_name || '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {log.resource_type}
                      {log.plugin_type ? ` · ${log.plugin_type}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={log.success ? 'secondary' : 'destructive'}>
                      {log.success ? '成功' : '失败'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{log.detail || '—'}</td>
                  <td className="px-4 py-3">
                    <details className="cursor-pointer">
                      <summary className="text-xs text-primary">展开</summary>
                      <div className="mt-2 space-y-2">
                        <pre className="rounded bg-secondary/40 p-3 text-xs whitespace-pre-wrap break-all">{parseJSONPreview(log.request_data)}</pre>
                        <pre className="rounded bg-secondary/40 p-3 text-xs whitespace-pre-wrap break-all">{parseJSONPreview(log.result_data)}</pre>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>每页</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setPage(1)
              }}
            >
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>{size} 条</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              上一页
            </Button>
            <span className="min-w-24 text-center text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
              下一页
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

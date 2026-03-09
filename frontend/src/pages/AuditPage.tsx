import { useEffect, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { auditService } from '@/services/auditService'
import type { AuditLog } from '@/types/audit'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

const MODULE_OPTIONS = [
  { value: '__all__', label: '全部模块' },
  { value: 'asset', label: '资产管理' },
  { value: 'connector', label: '中间件连接器' },
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
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [moduleFilter, setModuleFilter] = useState('__all__')
  const [statusFilter, setStatusFilter] = useState('__all__')
  const [keyword, setKeyword] = useState('')

  const loadLogs = async () => {
    setLoading(true)
    try {
      const result = await auditService.list({
        module: moduleFilter === '__all__' ? undefined : moduleFilter,
        success: statusFilter === '__all__' ? undefined : statusFilter === 'true',
        keyword: keyword || undefined,
        limit: 100,
        offset: 0,
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
    loadLogs()
  }, [])

  return (
    <div className="space-y-5 animate-in fade-in-0 duration-200">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">操作审计</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            统一查看资产变更、凭据操作和中间件连接行为，便于回溯问题与追踪接入过程。
          </p>
        </div>
        <Button variant="outline" onClick={loadLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新审计
        </Button>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 lg:grid-cols-[180px_180px_minmax(0,1fr)_120px]">
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger><SelectValue placeholder="模块" /></SelectTrigger>
          <SelectContent>
            {MODULE_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="状态" /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 rounded-md border border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
            placeholder="搜索资源名、错误信息或结果摘要"
            className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <Button onClick={loadLogs} loading={loading}>查询</Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">共 {total} 条审计记录</span>
          <span className="text-muted-foreground">当前展示最近 {logs.length} 条</span>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
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
      </div>
    </div>
  )
}

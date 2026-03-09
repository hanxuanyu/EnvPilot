import { useEffect, useMemo, useState } from 'react'
import { Globe, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal, FormField } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { assetService, environmentService } from '@/services/assetService'
import { dnsService } from '@/services/dnsService'
import type { Asset, Environment } from '@/types/asset'
import type {
  CreateDNSRecordReq,
  DNSRecord,
  DNSQueryLog,
  DNSRuntimeStatus,
  DNSRecordType,
  UpdateDNSRecordReq,
} from '@/types/dns'

type FilterStatus = '__all__' | 'enabled' | 'disabled'
type TargetMode = 'manual' | 'asset'

const DNS_LOG_PAGE_SIZE_OPTIONS = [20, 50, 100]

interface FormState {
  environment_id: number
  asset_id?: number
  domain: string
  record_type: DNSRecordType
  value: string
  ttl: number
  enabled: boolean
}

const EMPTY_FORM: FormState = {
  environment_id: 0,
  domain: '',
  record_type: 'A',
  value: '',
  ttl: 300,
  enabled: true,
}

function recordTarget(record: DNSRecord): string {
  if (record.asset) {
    const host = record.asset.ext_config?.host as string | undefined
    return host ? `${record.asset.name} -> ${host}` : `${record.asset.name} -> ${record.value}`
  }
  return record.value
}

export default function DnsPage() {
  const [records, setRecords] = useState<DNSRecord[]>([])
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [runtimeStatus, setRuntimeStatus] = useState<DNSRuntimeStatus | null>(null)
  const [queryLogs, setQueryLogs] = useState<DNSQueryLog[]>([])
  const [queryLogTotal, setQueryLogTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [logLoading, setLogLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [selectedEnv, setSelectedEnv] = useState<number | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('__all__')
  const [showForm, setShowForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState<DNSRecord | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [targetMode, setTargetMode] = useState<TargetMode>('manual')
  const [logPage, setLogPage] = useState(1)
  const [logPageSize, setLogPageSize] = useState(20)

  const selectedEnvId = selectedEnv === 'all' ? undefined : selectedEnv
  const logTotalPages = Math.max(1, Math.ceil(queryLogTotal / logPageSize))

  const hostAssets = useMemo(
    () => assets.filter(asset => typeof asset.ext_config?.host === 'string' && asset.ext_config.host),
    [assets],
  )

  const loadEnvironments = async () => {
    const envs = await environmentService.list() as Environment[]
    setEnvironments(envs)
    if (selectedEnv === 'all' && envs.length > 0) {
      const firstEnvId = envs[0].id
      setForm(prev => ({ ...prev, environment_id: prev.environment_id || firstEnvId }))
    }
  }

  const loadAssets = async (environmentId?: number) => {
    const list = await assetService.list({ environment_id: environmentId }) as Asset[]
    setAssets(list)
  }

  const loadRecords = async () => {
    setLoading(true)
    try {
      const enabled = statusFilter === '__all__'
        ? undefined
        : statusFilter === 'enabled'
      const list = await dnsService.list({
        environment_id: selectedEnvId,
        keyword: appliedKeyword || undefined,
        enabled,
      })
      setRecords(list)
    } catch (error: any) {
      toast.error('加载 DNS 记录失败', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const loadStatus = async () => {
    setStatusLoading(true)
    try {
      const status = await dnsService.getStatus()
      setRuntimeStatus(status)
    } catch (error: any) {
      toast.error('加载 DNS 服务状态失败', { description: error.message })
    } finally {
      setStatusLoading(false)
    }
  }

  const loadQueryLogs = async () => {
    setLogLoading(true)
    try {
      const result = await dnsService.listQueryLogs({
        environment_id: selectedEnvId,
        keyword: appliedKeyword || undefined,
        limit: logPageSize,
        offset: (logPage - 1) * logPageSize,
      })
      setQueryLogs(result.items ?? [])
      setQueryLogTotal(result.total ?? 0)
    } catch (error: any) {
      toast.error('加载 DNS 查询日志失败', { description: error.message })
    } finally {
      setLogLoading(false)
    }
  }

  const refreshAll = async () => {
    await Promise.all([loadRecords(), loadStatus(), loadQueryLogs()])
  }

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await loadEnvironments()
      } catch (error: any) {
        toast.error('加载环境失败', { description: error.message })
      }
    }
    bootstrap()
  }, [])

  useEffect(() => {
    loadRecords()
    loadAssets(selectedEnvId)
    loadStatus()
  }, [selectedEnv, statusFilter, appliedKeyword])

  useEffect(() => {
    loadQueryLogs()
  }, [selectedEnv, appliedKeyword, logPage, logPageSize])

  const handleSearch = async () => {
    const nextKeyword = keyword.trim()
    const changed = nextKeyword !== appliedKeyword
    setAppliedKeyword(nextKeyword)
    if (logPage !== 1) {
      setLogPage(1)
    } else {
      if (!changed) {
        await refreshAll()
      }
    }
  }

  const resetForm = () => {
    setEditingRecord(null)
    setTargetMode('manual')
    setForm({
      ...EMPTY_FORM,
      environment_id: selectedEnvId ?? environments[0]?.id ?? 0,
    })
  }

  const openCreateForm = () => {
    resetForm()
    setShowForm(true)
  }

  const openEditForm = async (record: DNSRecord) => {
    const environmentId = record.environment_id
    setEditingRecord(record)
    setTargetMode(record.asset_id ? 'asset' : 'manual')
    setForm({
      environment_id: environmentId,
      asset_id: record.asset_id,
      domain: record.domain,
      record_type: record.record_type,
      value: record.value,
      ttl: record.ttl,
      enabled: record.enabled,
    })
    try {
      await loadAssets(environmentId)
    } catch (error: any) {
      toast.error('加载环境资产失败', { description: error.message })
    }
    setShowForm(true)
  }

  const handleEnvironmentChange = async (value: string) => {
    const environmentId = Number(value)
    setForm(prev => ({
      ...prev,
      environment_id: environmentId,
      asset_id: undefined,
    }))
    try {
      await loadAssets(environmentId)
    } catch (error: any) {
      toast.error('加载环境资产失败', { description: error.message })
    }
  }

  const handleSubmit = async () => {
    if (!form.environment_id) {
      toast.error('请选择环境')
      return
    }
    setSaving(true)
    try {
      if (editingRecord) {
        const payload: UpdateDNSRecordReq = {
          id: editingRecord.id,
          asset_id: targetMode === 'asset' ? form.asset_id : undefined,
          domain: form.domain,
          record_type: form.record_type,
          value: targetMode === 'asset' ? '' : form.value,
          ttl: Number(form.ttl),
          enabled: form.enabled,
        }
        await dnsService.update(payload)
        toast.success(`DNS 记录「${form.domain}」已更新`)
      } else {
        const payload: CreateDNSRecordReq = {
          environment_id: form.environment_id,
          asset_id: targetMode === 'asset' ? form.asset_id : undefined,
          domain: form.domain,
          record_type: form.record_type,
          value: targetMode === 'asset' ? '' : form.value,
          ttl: Number(form.ttl),
          enabled: form.enabled,
        }
        await dnsService.create(payload)
        toast.success(`DNS 记录「${form.domain}」已创建`)
      }
      setShowForm(false)
      resetForm()
      await loadRecords()
    } catch (error: any) {
      toast.error(editingRecord ? '更新 DNS 记录失败' : '创建 DNS 记录失败', {
        description: error.message,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (record: DNSRecord) => {
    try {
      await dnsService.delete(record.id)
      toast.success(`DNS 记录「${record.domain}」已删除`)
      await loadRecords()
    } catch (error: any) {
      toast.error('删除 DNS 记录失败', { description: error.message })
    }
  }

  const handleToggle = async (record: DNSRecord) => {
    try {
      await dnsService.setEnabled(record.id, !record.enabled)
      toast.success(`DNS 记录已${record.enabled ? '停用' : '启用'}`)
      await loadRecords()
    } catch (error: any) {
      toast.error('更新 DNS 状态失败', { description: error.message })
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in-0 duration-200">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">DNS 管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            维护环境隔离的 A / CNAME 记录。A 记录支持直接绑定资产并自动使用资产 host。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refreshAll} disabled={loading || logLoading || statusLoading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4" />
            新增记录
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 lg:grid-cols-[180px_160px_minmax(0,1fr)_120px]">
        <Select value={selectedEnv === 'all' ? '__all__' : String(selectedEnv)} onValueChange={(value) => setSelectedEnv(value === '__all__' ? 'all' : Number(value))}>
          <SelectTrigger><SelectValue placeholder="全部环境" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部环境</SelectItem>
            {environments.map(env => (
              <SelectItem key={env.id} value={String(env.id)}>{env.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FilterStatus)}>
          <SelectTrigger><SelectValue placeholder="全部状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部状态</SelectItem>
            <SelectItem value="enabled">启用中</SelectItem>
            <SelectItem value="disabled">已停用</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 rounded-md border border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索域名或目标值"
            className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <Button onClick={handleSearch} loading={loading || logLoading}>查询</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">服务开关</div>
          <div className="mt-2 text-lg font-semibold text-foreground">
            {statusLoading ? '加载中...' : runtimeStatus?.enabled ? '已启用' : '未启用'}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">运行状态</div>
          <div className="mt-2 text-lg font-semibold text-foreground">
            {statusLoading ? '加载中...' : runtimeStatus?.running ? '运行中' : '未运行'}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">监听地址</div>
          <div className="mt-2 break-all text-sm font-medium text-foreground">
            {runtimeStatus?.listen_addr || '—'}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">上游 DNS</div>
          <div className="mt-2 break-all text-sm font-medium text-foreground">
            {runtimeStatus?.upstream || '—'}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">共 {records.length} 条 DNS 记录</span>
          <span className="text-muted-foreground">当前支持 A / CNAME</span>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-secondary/60 border-b border-border">
                {['域名', '环境', '类型', '目标值', 'TTL', '状态', '操作'].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-sm text-muted-foreground">
                    还没有 DNS 记录，点击「新增记录」开始维护。
                  </td>
                </tr>
              ) : records.map(record => (
                <tr key={record.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <Globe className="h-4 w-4 text-primary" />
                      {record.domain}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      更新时间 {new Date(record.updated_at).toLocaleString('zh-CN')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{record.environment?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{record.record_type}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-foreground">{recordTarget(record)}</div>
                    {record.asset && (
                      <div className="mt-1 text-xs text-muted-foreground">资产绑定</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{record.ttl}s</td>
                  <td className="px-4 py-3">
                    <Badge variant={record.enabled ? 'secondary' : 'outline'}>
                      {record.enabled ? '启用中' : '已停用'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditForm(record)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleToggle(record)}>
                        {record.enabled ? '停用' : '启用'}
                      </Button>
                      <ConfirmDialog
                        title="删除 DNS 记录"
                        description={`确定要删除记录「${record.domain}」吗？此操作不可撤销。`}
                        confirmText="删除"
                        danger
                        onConfirm={() => handleDelete(record)}
                      >
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </ConfirmDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">共 {queryLogTotal} 条 DNS 查询日志</span>
          <span className="text-muted-foreground">默认 TTL {runtimeStatus?.default_ttl ?? '—'}</span>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-secondary/60 border-b border-border">
                {['时间', '域名', '环境', '类型', '来源', '响应', '耗时'].map((header) => (
                  <th key={header} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queryLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {logLoading ? '正在加载查询日志...' : '暂无查询日志。'}
                  </td>
                </tr>
              ) : queryLogs.map(log => (
                <tr key={log.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(log.queried_at).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{log.domain}</div>
                    {log.answer_summary && (
                      <div className="mt-1 max-w-xl truncate text-xs text-muted-foreground">{log.answer_summary}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{log.environment?.name || '未命中环境'}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{log.question_type}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{log.source}</td>
                  <td className="px-4 py-3">
                    <Badge variant={log.hit_local ? 'secondary' : 'outline'}>{log.response_code}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{log.duration_ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>每页</span>
            <Select
              value={String(logPageSize)}
              onValueChange={(value) => {
                setLogPageSize(Number(value))
                setLogPage(1)
              }}
            >
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DNS_LOG_PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>{size} 条</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={logPage <= 1 || logLoading} onClick={() => setLogPage((current) => Math.max(1, current - 1))}>
              上一页
            </Button>
            <span className="min-w-24 text-center text-muted-foreground">{logPage} / {logTotalPages}</span>
            <Button variant="outline" size="sm" disabled={logPage >= logTotalPages || logLoading} onClick={() => setLogPage((current) => Math.min(logTotalPages, current + 1))}>
              下一页
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingRecord ? '编辑 DNS 记录' : '新增 DNS 记录'}
        footer={(
          <>
            <Button variant="outline" onClick={() => setShowForm(false)}>取消</Button>
            <Button onClick={handleSubmit} loading={saving}>{editingRecord ? '保存修改' : '创建记录'}</Button>
          </>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="所属环境" required>
            <Select value={form.environment_id ? String(form.environment_id) : undefined} onValueChange={handleEnvironmentChange}>
              <SelectTrigger><SelectValue placeholder="选择环境" /></SelectTrigger>
              <SelectContent>
                {environments.map(env => (
                  <SelectItem key={env.id} value={String(env.id)}>{env.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="记录类型" required>
            <Select
              value={form.record_type}
              onValueChange={(value) => {
                const nextType = value as DNSRecordType
                setForm(prev => ({ ...prev, record_type: nextType, asset_id: nextType === 'A' ? prev.asset_id : undefined }))
                if (nextType !== 'A') setTargetMode('manual')
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A">A</SelectItem>
                <SelectItem value="CNAME">CNAME</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="域名" required className="md:col-span-2">
            <Input
              value={form.domain}
              onChange={(e) => setForm(prev => ({ ...prev, domain: e.target.value }))}
              placeholder="例如 api.dev.local"
            />
          </FormField>

          <FormField label="目标来源" required>
            <Select value={targetMode} onValueChange={(value) => setTargetMode(value as TargetMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">手动填写</SelectItem>
                <SelectItem value="asset" disabled={form.record_type !== 'A'}>绑定资产 host</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="状态" required>
            <Select value={form.enabled ? 'enabled' : 'disabled'} onValueChange={(value) => setForm(prev => ({ ...prev, enabled: value === 'enabled' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="enabled">启用</SelectItem>
                <SelectItem value="disabled">停用</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          {targetMode === 'asset' ? (
            <FormField label="目标资产" required className="md:col-span-2">
              <Select value={form.asset_id ? String(form.asset_id) : undefined} onValueChange={(value) => setForm(prev => ({ ...prev, asset_id: Number(value) }))}>
                <SelectTrigger><SelectValue placeholder="选择带 host 的资产" /></SelectTrigger>
                <SelectContent>
                  {hostAssets.map(asset => (
                    <SelectItem key={asset.id} value={String(asset.id)}>
                      {asset.name} ({String(asset.ext_config.host)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : (
            <FormField label="目标值" required className="md:col-span-2">
              <Input
                value={form.value}
                onChange={(e) => setForm(prev => ({ ...prev, value: e.target.value }))}
                placeholder={form.record_type === 'A' ? '例如 10.0.0.12' : '例如 upstream.example.com'}
              />
            </FormField>
          )}

          <FormField label="TTL（秒）" required>
            <Input
              type="number"
              min={30}
              max={86400}
              value={form.ttl}
              onChange={(e) => setForm(prev => ({ ...prev, ttl: Number(e.target.value) || 300 }))}
            />
          </FormField>
        </div>
      </Modal>
    </div>
  )
}

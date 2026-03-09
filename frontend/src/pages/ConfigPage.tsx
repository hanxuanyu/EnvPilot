import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock3, GitCommitHorizontal, History, RefreshCw, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { getVersion, type VersionInfo } from '@/services/backendService'
import { configService } from '@/services/configService'
import type { AppConfig, ConfigSnapshot, CurrentConfigResult } from '@/types/config'

const SNAPSHOT_PAGE_SIZE = 30

function deepCloneConfig(config: AppConfig): AppConfig {
  return JSON.parse(JSON.stringify(config)) as AppConfig
}

interface DiffRow {
  left?: string
  right?: string
  status: 'same' | 'changed' | 'added' | 'removed'
}

function buildDiffRows(leftText: string, rightText: string): DiffRow[] {
  const left = leftText.split('\n')
  const right = rightText.split('\n')
  const max = Math.max(left.length, right.length)
  const rows: DiffRow[] = []

  for (let index = 0; index < max; index += 1) {
    const leftLine = left[index]
    const rightLine = right[index]
    if (leftLine === rightLine) {
      rows.push({ left: leftLine, right: rightLine, status: 'same' })
      continue
    }
    if (leftLine === undefined) {
      rows.push({ right: rightLine, status: 'added' })
      continue
    }
    if (rightLine === undefined) {
      rows.push({ left: leftLine, status: 'removed' })
      continue
    }
    rows.push({ left: leftLine, right: rightLine, status: 'changed' })
  }

  return rows
}

function diffToneClass(status: DiffRow['status']) {
  if (status === 'added') return 'bg-emerald-500/8'
  if (status === 'removed') return 'bg-rose-500/8'
  if (status === 'changed') return 'bg-amber-500/8'
  return ''
}

function formatSnapshotComment(snapshot: ConfigSnapshot) {
  return snapshot.comment?.trim() || '未填写备注'
}

function getHotReloadState(result?: CurrentConfigResult['hot_reload']) {
  return {
    applied: result?.applied ?? [],
    restart_required: result?.restart_required ?? [],
    messages: result?.messages ?? [],
  }
}

function summarizeHotReload(result?: CurrentConfigResult['hot_reload']) {
  const hotReload = getHotReloadState(result)
  const parts: string[] = []
  if (hotReload.applied.length > 0) parts.push(`已热更新 ${hotReload.applied.join(' / ')}`)
  if (hotReload.restart_required.length > 0) parts.push(`需重启 ${hotReload.restart_required.join(' / ')}`)
  if (parts.length === 0 && hotReload.messages.length > 0) parts.push(hotReload.messages[0])
  return parts.join('，')
}

function FieldBlock({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-foreground">{label}</div>
          {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
        </div>
      </div>
      {children}
    </div>
  )
}

function SwitchRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string
  hint: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export default function ConfigPage() {
  const [current, setCurrent] = useState<CurrentConfigResult | null>(null)
  const [draft, setDraft] = useState<AppConfig | null>(null)
  const [snapshots, setSnapshots] = useState<ConfigSnapshot[]>([])
  const [selectedSnapshot, setSelectedSnapshot] = useState<ConfigSnapshot | null>(null)
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [rollbackComment, setRollbackComment] = useState('')
  const [showSaltFile, setShowSaltFile] = useState(false)

  const hotReload = getHotReloadState(current?.hot_reload)

  const loadData = async (preserveSelection = true) => {
    setLoading(true)
    try {
      const [currentResult, snapshotResult] = await Promise.all([
        configService.getCurrent(),
        configService.listSnapshots({ limit: SNAPSHOT_PAGE_SIZE, offset: 0 }),
      ])
      try {
        const version = await getVersion()
        setVersionInfo(version)
      } catch {
        setVersionInfo(null)
      }
      setCurrent(currentResult)
      setDraft(deepCloneConfig(currentResult.config))
      setSnapshots(snapshotResult.items)

      if (!preserveSelection) {
        setSelectedSnapshot(snapshotResult.items[0] || null)
      } else if (selectedSnapshot) {
        const matched = snapshotResult.items.find((item) => item.id === selectedSnapshot.id)
        setSelectedSnapshot(matched || snapshotResult.items[0] || null)
      } else {
        setSelectedSnapshot(snapshotResult.items[0] || null)
      }
    } catch (error: any) {
      toast.error('加载配置失败', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(false)
  }, [])

  const diffRows = useMemo(() => {
    if (!current || !selectedSnapshot) return []
    return buildDiffRows(selectedSnapshot.content, current.yaml)
  }, [current, selectedSnapshot])

  const handleSave = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const result = await configService.update({
        config: draft,
        comment: comment.trim() || undefined,
        operator: 'admin',
      })
      toast.success('配置已保存', { description: summarizeHotReload(result.hot_reload) || undefined })
      setComment('')
      await loadData(false)
    } catch (error: any) {
      toast.error('保存配置失败', { description: error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleRollback = async () => {
    if (!selectedSnapshot) return
    setRollingBack(true)
    try {
      const result = await configService.rollback({
        snapshot_id: selectedSnapshot.id,
        comment: rollbackComment.trim() || undefined,
        operator: 'admin',
      })
      toast.success(`已回滚到 v${selectedSnapshot.version}`, {
        description: summarizeHotReload(result.hot_reload) || undefined,
      })
      setRollbackComment('')
      setCompareOpen(false)
      await loadData(false)
    } catch (error: any) {
      toast.error('回滚配置失败', { description: error.message })
    } finally {
      setRollingBack(false)
    }
  }

  if (!draft || !current) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
        正在加载配置...
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in-0 duration-200">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">系统配置</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            主页面专注配置编辑；版本来自构建元数据，快照对比与回滚在弹窗中完成。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={handleSave} loading={saving}>
            <Save className="h-4 w-4" />
            保存配置
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_340px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{current.config_path}</Badge>
              {versionInfo ? (
                <Badge variant="outline">
                  <GitCommitHorizontal className="h-3 w-3" />
                  {versionInfo.version} · {versionInfo.commit}
                </Badge>
              ) : null}
              {current.requires_restart && (
                <Badge variant="secondary">
                  <Clock3 className="h-3 w-3" />
                  存在需重启项
                </Badge>
              )}
              {current.latest_snapshot ? <Badge variant="outline">当前快照 v{current.latest_snapshot.version}</Badge> : null}
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_320px]">
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="填写本次配置修改说明，便于审计与版本回溯"
                className="min-h-[78px]"
              />
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 p-3 text-xs leading-6 text-amber-100">
                <div className="flex items-center gap-2 font-medium text-amber-50">
                  <AlertTriangle className="h-4 w-4" />
                  热更新摘要
                </div>
                <div className="mt-2">{summarizeHotReload(current.hot_reload) || '尚未执行新的配置变更。'}</div>
                {hotReload.messages.map((message) => (
                  <div key={message}>{message}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">应用</h2>
              <FieldBlock label="应用名称" hint="仅影响展示与接口返回名称">
                <Input value={draft.app.name} onChange={(e) => setDraft({ ...draft, app: { ...draft.app, name: e.target.value } })} placeholder="应用名称" />
              </FieldBlock>
              <FieldBlock label="数据目录" hint="修改后通常需要重启，影响数据库和密钥文件定位">
                <Input value={draft.app.data_dir} onChange={(e) => setDraft({ ...draft, app: { ...draft.app, data_dir: e.target.value } })} placeholder="数据目录" />
              </FieldBlock>
              <FieldBlock label="日志目录" hint="日志组件会尝试在线切换输出路径">
                <Input value={draft.app.log_dir} onChange={(e) => setDraft({ ...draft, app: { ...draft.app, log_dir: e.target.value } })} placeholder="日志目录" />
              </FieldBlock>
            </section>

            <section className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">日志</h2>
              <FieldBlock label="日志级别">
                <Select value={draft.log.level} onValueChange={(value) => setDraft({ ...draft, log: { ...draft.log, level: value } })}>
                  <SelectTrigger><SelectValue placeholder="日志级别" /></SelectTrigger>
                  <SelectContent>
                    {['debug', 'info', 'warn', 'error'].map((level) => (
                      <SelectItem key={level} value={level}>{level.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldBlock>
              <FieldBlock label="日志文件名">
                <Input value={draft.log.filename} onChange={(e) => setDraft({ ...draft, log: { ...draft.log, filename: e.target.value } })} placeholder="日志文件名" />
              </FieldBlock>
              <div className="grid grid-cols-3 gap-3">
                <FieldBlock label="单文件 MB">
                  <Input type="number" value={draft.log.max_size} onChange={(e) => setDraft({ ...draft, log: { ...draft.log, max_size: Number(e.target.value) } })} placeholder="大小 MB" />
                </FieldBlock>
                <FieldBlock label="备份数">
                  <Input type="number" value={draft.log.max_backups} onChange={(e) => setDraft({ ...draft, log: { ...draft.log, max_backups: Number(e.target.value) } })} placeholder="备份数" />
                </FieldBlock>
                <FieldBlock label="保留天数">
                  <Input type="number" value={draft.log.max_age} onChange={(e) => setDraft({ ...draft, log: { ...draft.log, max_age: Number(e.target.value) } })} placeholder="保留天数" />
                </FieldBlock>
              </div>
              <SwitchRow
                label="压缩归档"
                hint="切换后日志组件会立即使用新策略"
                checked={draft.log.compress}
                onCheckedChange={(checked) => setDraft({ ...draft, log: { ...draft.log, compress: checked } })}
              />
            </section>

            <section className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">数据库</h2>
              <FieldBlock label="数据库文件名" hint="修改后需要重启重新打开 SQLite 文件">
                <Input value={draft.database.filename} onChange={(e) => setDraft({ ...draft, database: { ...draft.database, filename: e.target.value } })} placeholder="数据库文件名" />
              </FieldBlock>
              <div className="grid grid-cols-2 gap-3">
                <FieldBlock label="Max Idle">
                  <Input type="number" value={draft.database.max_idle_conns} onChange={(e) => setDraft({ ...draft, database: { ...draft.database, max_idle_conns: Number(e.target.value) } })} placeholder="Max Idle" />
                </FieldBlock>
                <FieldBlock label="Max Open">
                  <Input type="number" value={draft.database.max_open_conns} onChange={(e) => setDraft({ ...draft, database: { ...draft.database, max_open_conns: Number(e.target.value) } })} placeholder="Max Open" />
                </FieldBlock>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">安全</h2>
              <SwitchRow
                label="主密码保护"
                hint="仅更新配置值，是否生效取决于后续安全链路实现"
                checked={draft.security.master_password_enabled}
                onCheckedChange={(checked) => setDraft({ ...draft, security: { ...draft.security, master_password_enabled: checked } })}
              />
              <div className="flex gap-2">
                <Input
                  type={showSaltFile ? 'text' : 'password'}
                  value={draft.security.salt_file}
                  onChange={(e) => setDraft({ ...draft, security: { ...draft.security, salt_file: e.target.value } })}
                  placeholder="Salt 文件路径"
                />
                <Button type="button" variant="outline" onClick={() => setShowSaltFile((currentValue) => !currentValue)}>
                  {showSaltFile ? '隐藏' : '显示'}
                </Button>
              </div>
              <FieldBlock label="危险命令规则" hint="每行一个正则或关键字，保存后立即更新执行拦截规则">
                <Textarea
                  value={draft.security.dangerous_commands.join('\n')}
                  onChange={(e) => setDraft({
                    ...draft,
                    security: {
                      ...draft.security,
                      dangerous_commands: e.target.value.split('\n').map((item) => item.trim()).filter(Boolean),
                    },
                  })}
                  placeholder="每行一个危险命令关键字"
                  className="min-h-[96px]"
                />
              </FieldBlock>
            </section>

            <section className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">DNS</h2>
              <SwitchRow
                label="启用内置 DNS"
                hint="保存后会直接重启 DNS runtime 应用新配置"
                checked={draft.dns.enabled}
                onCheckedChange={(checked) => setDraft({ ...draft, dns: { ...draft.dns, enabled: checked } })}
              />
              <FieldBlock label="监听地址">
                <Input value={draft.dns.listen_addr} onChange={(e) => setDraft({ ...draft, dns: { ...draft.dns, listen_addr: e.target.value } })} placeholder="监听地址" />
              </FieldBlock>
              <FieldBlock label="上游 DNS">
                <Input value={draft.dns.upstream} onChange={(e) => setDraft({ ...draft, dns: { ...draft.dns, upstream: e.target.value } })} placeholder="上游 DNS" />
              </FieldBlock>
              <FieldBlock label="默认 TTL">
                <Input type="number" value={draft.dns.default_ttl} onChange={(e) => setDraft({ ...draft, dns: { ...draft.dns, default_ttl: Number(e.target.value) } })} placeholder="默认 TTL" />
              </FieldBlock>
            </section>

            <section className="rounded-xl border border-border bg-card p-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">健康检查</h2>
              <SwitchRow
                label="自动健康检查"
                hint="保存后自动重建调度器并使用新周期"
                checked={draft.health.auto_check}
                onCheckedChange={(checked) => setDraft({ ...draft, health: { ...draft.health, auto_check: checked } })}
              />
              <div className="grid grid-cols-2 gap-3">
                <FieldBlock label="检查间隔（秒）">
                  <Input type="number" value={draft.health.check_interval} onChange={(e) => setDraft({ ...draft, health: { ...draft.health, check_interval: Number(e.target.value) } })} placeholder="检查间隔（秒）" />
                </FieldBlock>
                <FieldBlock label="超时（秒）">
                  <Input type="number" value={draft.health.timeout} onChange={(e) => setDraft({ ...draft, health: { ...draft.health, timeout: Number(e.target.value) } })} placeholder="超时（秒）" />
                </FieldBlock>
              </div>
            </section>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <History className="h-4 w-4" />
                版本快照
              </div>
              <span className="text-xs text-muted-foreground">最近 {snapshots.length} 条</span>
            </div>
            <div className="max-h-[420px] overflow-auto p-2">
              {snapshots.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">暂无配置快照</div>
              ) : snapshots.map((snapshot) => (
                <button
                  key={snapshot.id}
                  type="button"
                  onClick={async () => {
                    try {
                      const detail = await configService.getSnapshot(snapshot.id)
                      setSelectedSnapshot(detail.snapshot)
                    } catch (error: any) {
                      toast.error('加载快照详情失败', { description: error.message })
                    }
                  }}
                  className={`mb-2 w-full rounded-lg border px-3 py-3 text-left transition-colors ${selectedSnapshot?.id === snapshot.id ? 'border-primary bg-primary/5' : 'border-border bg-background/40 hover:bg-accent/40'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">v{snapshot.version}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">{formatSnapshotComment(snapshot)}</div>
                    </div>
                    <Badge variant="outline">{snapshot.created_by || 'system'}</Badge>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">{new Date(snapshot.created_at).toLocaleString('zh-CN')}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">快照操作</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  选中快照后在弹窗查看 diff，并可附带说明执行回滚。
                </p>
              </div>
              {selectedSnapshot ? <Badge variant="outline">v{selectedSnapshot.version}</Badge> : null}
            </div>
            {selectedSnapshot ? (
              <>
                <div className="rounded-lg border border-border bg-background/60 px-3 py-3 text-xs leading-6 text-muted-foreground">
                  <div>备注：{formatSnapshotComment(selectedSnapshot)}</div>
                  <div>创建人：{selectedSnapshot.created_by || 'system'}</div>
                  <div>时间：{new Date(selectedSnapshot.created_at).toLocaleString('zh-CN')}</div>
                </div>
                <Button variant="outline" onClick={() => setCompareOpen(true)}>
                  <History className="h-4 w-4" />
                  打开对比与回滚
                </Button>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                选择一个快照后即可打开对比弹窗。
              </div>
            )}
          </section>
        </div>
      </div>

      <Modal
        open={compareOpen && !!selectedSnapshot}
        onClose={() => setCompareOpen(false)}
        title={selectedSnapshot ? `配置快照 v${selectedSnapshot.version}` : '配置快照'}
        className="max-w-6xl"
        footer={selectedSnapshot ? (
          <>
            <Button variant="outline" onClick={() => setCompareOpen(false)}>关闭</Button>
            <Button variant="outline" onClick={handleRollback} loading={rollingBack}>
              <RotateCcw className="h-4 w-4" />
              回滚到此版本
            </Button>
          </>
        ) : null}
      >
        {selectedSnapshot ? (
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_1fr] gap-3 text-[11px] text-muted-foreground">
              <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">快照 v{selectedSnapshot.version}</div>
              <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">当前配置</div>
            </div>
            <div className="max-h-[58vh] overflow-auto rounded-lg border border-border bg-background/50">
              <div className="grid grid-cols-2 text-xs font-mono">
                {diffRows.map((row, index) => (
                  <div key={`row-${index}`} className="contents">
                    <div key={`left-${index}`} className={`border-b border-r border-border px-3 py-1.5 whitespace-pre-wrap break-all ${diffToneClass(row.status)}`}>{row.left ?? ''}</div>
                    <div key={`right-${index}`} className={`border-b border-border px-3 py-1.5 whitespace-pre-wrap break-all ${diffToneClass(row.status)}`}>{row.right ?? ''}</div>
                  </div>
                ))}
              </div>
            </div>
            <Textarea
              value={rollbackComment}
              onChange={(event) => setRollbackComment(event.target.value)}
              placeholder={`填写回滚到 v${selectedSnapshot.version} 的原因`}
              className="min-h-[88px]"
            />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

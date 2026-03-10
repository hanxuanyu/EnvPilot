import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, Clock3, GitCommitHorizontal, History, RefreshCw, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Modal,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/components/common/AuthProvider'
import { authService } from '@/services/authService'
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

function hotReloadSummaryTone(hotReload: ReturnType<typeof getHotReloadState>) {
  if (hotReload.restart_required.length > 0) {
    return {
      border: 'color-mix(in srgb, #f59e0b 28%, var(--color-border))',
      background: 'color-mix(in srgb, #f59e0b 10%, var(--color-card))',
      title: 'color-mix(in srgb, #b45309 72%, var(--color-foreground))',
      body: 'color-mix(in srgb, #92400e 56%, var(--color-foreground))',
    }
  }

  if (hotReload.applied.length > 0) {
    return {
      border: 'color-mix(in srgb, #10b981 24%, var(--color-border))',
      background: 'color-mix(in srgb, #10b981 9%, var(--color-card))',
      title: 'color-mix(in srgb, #047857 72%, var(--color-foreground))',
      body: 'color-mix(in srgb, #065f46 54%, var(--color-foreground))',
    }
  }

  return {
    border: 'var(--color-border)',
    background: 'color-mix(in srgb, var(--color-secondary) 48%, transparent)',
    title: 'var(--color-foreground)',
    body: 'var(--color-muted-foreground)',
  }
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
  const { status, refreshStatus, openUnlock } = useAuth()
  const [current, setCurrent] = useState<CurrentConfigResult | null>(null)
  const [draft, setDraft] = useState<AppConfig | null>(null)
  const [snapshots, setSnapshots] = useState<ConfigSnapshot[]>([])
  const [selectedSnapshot, setSelectedSnapshot] = useState<ConfigSnapshot | null>(null)
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [loadingSnapshot, setLoadingSnapshot] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [rollbackComment, setRollbackComment] = useState('')
  const [showSaltFile, setShowSaltFile] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const hotReload = getHotReloadState(current?.hot_reload)
  const hotReloadTone = useMemo(() => hotReloadSummaryTone(hotReload), [hotReload])

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
    return buildDiffRows(current.yaml, selectedSnapshot.content)
  }, [current, selectedSnapshot])

  const handleSnapshotChange = async (snapshotID: string) => {
    setLoadingSnapshot(true)
    try {
      const detail = await configService.getSnapshot(Number(snapshotID))
      setSelectedSnapshot(detail.snapshot)
    } catch (error: any) {
      toast.error('加载快照详情失败', { description: error.message })
    } finally {
      setLoadingSnapshot(false)
    }
  }

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
      setRollbackConfirmOpen(false)
      setCompareOpen(false)
      await loadData(false)
    } catch (error: any) {
      toast.error('回滚配置失败', { description: error.message })
    } finally {
      setRollingBack(false)
    }
  }

  const handleChangePassword = async () => {
    setChangingPassword(true)
    try {
      await authService.changePassword(currentPassword, newPassword)
      toast.success('主密码已更新')
      setPasswordDialogOpen(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      await refreshStatus()
    } catch (error: any) {
      toast.error('修改主密码失败', { description: error.message })
    } finally {
      setChangingPassword(false)
    }
  }

  const passwordSubmitDisabled = !currentPassword || !newPassword || newPassword !== confirmPassword

  const handlePasswordDialogKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || passwordSubmitDisabled || changingPassword) return
    event.preventDefault()
    void handleChangePassword()
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
              <div
                className="rounded-lg border p-3 text-xs leading-6"
                style={{
                  borderColor: hotReloadTone.border,
                  backgroundColor: hotReloadTone.background,
                  color: hotReloadTone.body,
                }}
              >
                <div className="flex items-center gap-2 font-medium" style={{ color: hotReloadTone.title }}>
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

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">配置快照</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  快照管理已移入模态框，支持下拉选择历史版本、实时 diff 与二次确认回滚。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">共 {snapshots.length} 条</Badge>
                {selectedSnapshot ? <Badge variant="outline">当前选择 v{selectedSnapshot.version}</Badge> : null}
                <Button variant="outline" onClick={() => setCompareOpen(true)} disabled={snapshots.length === 0}>
                  <History className="h-4 w-4" />
                  快照与回滚
                </Button>
              </div>
            </div>
          </section>

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
                hint="启用后系统默认进入只读模式，需要输入主密码才能进入管理员模式"
                checked={draft.security.master_password_enabled}
                onCheckedChange={(checked) => setDraft({ ...draft, security: { ...draft.security, master_password_enabled: checked } })}
              />
              {draft.security.master_password_enabled ? (
                <div className="rounded-lg border border-border bg-background/60 p-3 text-xs text-muted-foreground space-y-3">
                  <div>当前状态：{status?.needs_setup ? '待初始化主密码' : status?.unlocked ? '已解锁' : '只读模式'}</div>
                  <div className="flex flex-wrap gap-2">
                    {status?.needs_setup ? (
                      <Button type="button" variant="outline" size="sm" onClick={openUnlock}>立即设置主密码</Button>
                    ) : (
                      <>
                        <Button type="button" variant="outline" size="sm" onClick={openUnlock}>输入主密码</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setPasswordDialogOpen(true)}>修改主密码</Button>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
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

      <Modal
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        title="修改主密码"
        footer={(
          <>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>取消</Button>
            <Button onClick={handleChangePassword} loading={changingPassword} disabled={passwordSubmitDisabled}>保存</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} onKeyDown={handlePasswordDialogKeyDown} placeholder="当前主密码" />
          <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} onKeyDown={handlePasswordDialogKeyDown} placeholder="新主密码，至少 8 位" />
          <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} onKeyDown={handlePasswordDialogKeyDown} placeholder="再次输入新主密码" />
          {confirmPassword && newPassword !== confirmPassword ? <div className="text-xs text-destructive">两次输入的主密码不一致</div> : null}
        </div>
      </Modal>

      <Modal
        open={compareOpen && !!selectedSnapshot}
        onClose={() => setCompareOpen(false)}
        title="配置快照与回滚"
        className="max-w-6xl"
        footer={selectedSnapshot ? (
          <>
            <Button variant="outline" onClick={() => setCompareOpen(false)}>关闭</Button>
            <Button variant="outline" onClick={() => setRollbackConfirmOpen(true)} disabled={loadingSnapshot || rollingBack}>
              <RotateCcw className="h-4 w-4" />
              回滚到此版本
            </Button>
          </>
        ) : null}
      >
        {selectedSnapshot ? (
          <div className="space-y-4">
            <div className="space-y-3 rounded-xl border border-border bg-background/40 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-foreground">实时差异对比</div>
                  <div className="text-xs text-muted-foreground">左侧是当前配置，右侧是选中的历史快照；变更会在下方实时展开。</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {current.latest_snapshot ? <Badge variant="outline">当前 v{current.latest_snapshot.version}</Badge> : <Badge variant="outline">当前配置</Badge>}
                    <Badge variant="outline">对比 v{selectedSnapshot.version}</Badge>
                    <Badge variant="outline">{selectedSnapshot.created_by || 'system'}</Badge>
                    <Badge variant="outline">{new Date(selectedSnapshot.created_at).toLocaleString('zh-CN')}</Badge>
                    <Badge variant="outline">{formatSnapshotComment(selectedSnapshot)}</Badge>
                    {loadingSnapshot ? <Badge variant="outline">加载中</Badge> : null}
                  </div>
                </div>
                <div className="w-full xl:w-80">
                  <div className="mb-1 text-[11px] text-muted-foreground">切换对比快照</div>
                  <Select value={String(selectedSnapshot.id)} onValueChange={handleSnapshotChange}>
                    <SelectTrigger disabled={loadingSnapshot}>
                      <SelectValue placeholder="选择快照版本" />
                    </SelectTrigger>
                    <SelectContent>
                      {snapshots.map((snapshot) => (
                        <SelectItem key={snapshot.id} value={String(snapshot.id)}>
                          {`v${snapshot.version} · ${formatSnapshotComment(snapshot)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_1fr] gap-3 text-[11px] text-muted-foreground">
                <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">当前配置</div>
                <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">快照 v{selectedSnapshot.version}</div>
              </div>
              <div className="max-h-[56vh] overflow-auto rounded-lg border border-border bg-background/50">
                <div className="grid grid-cols-2 text-xs font-mono">
                  {diffRows.map((row, index) => (
                    <div key={`row-${index}`} className="contents">
                      <div className={`border-b border-r border-border px-3 py-1.5 whitespace-pre-wrap break-all ${diffToneClass(row.status)}`}>{row.left ?? ''}</div>
                      <div className={`border-b border-border px-3 py-1.5 whitespace-pre-wrap break-all ${diffToneClass(row.status)}`}>{row.right ?? ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <AlertDialog open={rollbackConfirmOpen} onOpenChange={setRollbackConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认回滚配置？</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedSnapshot
                ? `将把当前配置回滚到 v${selectedSnapshot.version}，并基于回滚结果再生成一条新的快照记录，而不是直接切换当前指针。`
                : '将把当前配置回滚到所选快照，并生成新的快照记录。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">回滚备注</div>
            <Textarea
              value={rollbackComment}
              onChange={(event) => setRollbackComment(event.target.value)}
              placeholder={selectedSnapshot ? `填写回滚到 v${selectedSnapshot.version} 后生成新快照的原因` : '填写回滚原因'}
              className="min-h-[92px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollingBack}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleRollback} disabled={rollingBack || rollbackComment.trim() === ''}>
              {rollingBack ? '回滚中...' : '确认回滚'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// EnvironmentPage.tsx — 环境管理页面（shadcn 风格组件 + Sonner toast）
import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Layers, ChevronRight, RefreshCw, Download, Server, FolderTree, KeyRound, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useAssetStore } from '@/store/assetStore'
import { useAuth } from '@/components/common/AuthProvider'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal, FormField } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { StatusBadge } from '@/components/common/StatusBadge'
import { assetService, credentialService, environmentService, groupService } from '@/services/assetService'
import type { Asset, Credential, Environment, Group } from '@/types/asset'
import { CATEGORY_LABELS, CREDENTIAL_TYPE_LABELS, getAssetAddress } from '@/types/asset'

const ENV_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
]

export default function EnvironmentPage() {
  const { isReadOnly, promptUnlock } = useAuth()
  const { environments, loading, loadEnvironments } = useAssetStore()
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [envAssets, setEnvAssets] = useState<Asset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [showEnvForm, setShowEnvForm] = useState(false)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [includeSensitive, setIncludeSensitive] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [viewMode, setViewMode] = useState<'resources' | 'groups'>('resources')
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)

  useEffect(() => { loadEnvironments() }, [])

  useEffect(() => {
    if (environments.length === 0) {
      setSelectedEnv(null)
      return
    }

    if (!selectedEnv) {
      setSelectedEnv(environments[0])
      return
    }

    const matched = environments.find((environment) => environment.id === selectedEnv.id)
    if (!matched) {
      setSelectedEnv(environments[0])
      return
    }

    if (matched !== selectedEnv) {
      setSelectedEnv(matched)
    }
  }, [environments, selectedEnv])

  useEffect(() => {
    if (!selectedEnv) {
      setGroups([])
      setEnvAssets([])
      return
    }

    setAssetsLoading(true)
    Promise.all([
      groupService.listByEnvironment(selectedEnv.id),
      assetService.list({ environment_id: selectedEnv.id }),
    ])
      .then(([groupList, assetList]) => {
        setGroups(groupList as Group[])
        setEnvAssets(assetList as Asset[])
      })
      .catch((error: any) => toast.error('加载环境详情失败', { description: error.message }))
      .finally(() => setAssetsLoading(false))
  }, [selectedEnv])

  const resourceSummary = useMemo(() => {
    const credentialCount = new Set(envAssets.map((asset) => asset.credential_id).filter(Boolean)).size
    return {
      total: envAssets.length,
      groups: groups.length,
      credentials: credentialCount,
    }
  }, [envAssets, groups])

  const refreshSelectedEnvironment = async () => {
    await loadEnvironments()
    if (!selectedEnv) return
    setAssetsLoading(true)
    try {
      const [groupList, assetList] = await Promise.all([
        groupService.listByEnvironment(selectedEnv.id),
        assetService.list({ environment_id: selectedEnv.id }),
      ])
      setGroups(groupList as Group[])
      setEnvAssets(assetList as Asset[])
    } catch (error: any) {
      toast.error('刷新环境数据失败', { description: error.message })
    } finally {
      setAssetsLoading(false)
    }
  }

  const handleDeleteEnv = async (id: number) => {
    try {
      await environmentService.delete(id)
      toast.success('环境已删除')
      if (selectedEnv?.id === id) setSelectedEnv(null)
      await loadEnvironments()
    } catch (e: any) {
      toast.error('删除失败', { description: e.message })
    }
  }

  const handleDeleteGroup = async (id: number) => {
    try {
      await groupService.delete(id)
      toast.success('分组已删除')
      if (selectedEnv) {
        setGroups(await groupService.listByEnvironment(selectedEnv.id) as Group[])
      }
    } catch (e: any) {
      toast.error('删除失败', { description: e.message })
    }
  }

  const handleExportWorkbook = async () => {
    if (environments.length === 0) {
      toast.info('当前没有环境可供导出')
      return
    }

    if (includeSensitive && isReadOnly) {
      promptUnlock('解锁后才能导出包含账号密码和完整连接配置的 Excel。')
      return
    }

    setExporting(true)
    try {
      const { downloadAssetsWorkbook, makeWorkbookFileName } = await import('@/lib/assetWorkbook')
      const allAssets = await assetService.list() as Asset[]
      let credentials: Credential[] = []
      const secretsByCredentialId: Record<number, string> = {}

      if (includeSensitive) {
        credentials = await credentialService.list() as Credential[]
        const credentialIDs = Array.from(new Set(allAssets.map((asset) => asset.credential_id).filter((value): value is number => !!value)))
        for (const credentialID of credentialIDs) {
          secretsByCredentialId[credentialID] = await credentialService.reveal(credentialID)
        }
      }

      const saved = await downloadAssetsWorkbook({
        fileName: makeWorkbookFileName('环境资源清单'),
        assets: allAssets,
        credentials,
        secretsByCredentialId,
        environments,
        includeSensitive,
        exportMode: 'environment',
      })
      if (saved) {
        setShowExportModal(false)
        toast.success(`已导出 ${environments.length} 个环境的资源清单`)
      }
    } catch (error: any) {
      toast.error('导出失败', { description: error.message })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex gap-6 h-full animate-in fade-in-0 duration-200">
      <div className="w-72 flex flex-col gap-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">环境列表</h2>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              title="刷新"
              disabled={loading}
              onClick={async () => {
                await refreshSelectedEnvironment()
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowExportModal(true)}>
              <Download className="w-3.5 h-3.5" /> 导出 Excel
            </Button>
            {!isReadOnly ? (
              <Button size="sm" onClick={() => {
                setEditingEnv(null)
                setShowEnvForm(true)
              }}>
                <Plus className="w-3.5 h-3.5" /> 新建环境
              </Button>
            ) : null}
          </div>
        </div>
        <div className="space-y-1.5">
          {environments.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              暂无环境，点击「新建环境」开始
            </div>
          ) : environments.map(env => (
            <div
              key={env.id}
              onClick={() => setSelectedEnv(env)}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all border hover:border-primary/40"
              style={{
                backgroundColor: selectedEnv?.id === env.id ? 'var(--color-accent)' : 'var(--color-card)',
                borderColor: selectedEnv?.id === env.id ? env.color + '50' : 'var(--color-border)',
              }}
            >
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: env.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-foreground">{env.name}</div>
                {env.description && (
                  <div className="text-xs truncate mt-0.5 text-muted-foreground">{env.description}</div>
                )}
              </div>
              {!isReadOnly ? (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost" size="icon"
                    onClick={e => {
                      e.stopPropagation()
                      setEditingEnv(env)
                      setShowEnvForm(true)
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <ConfirmDialog
                    title="删除环境"
                    description={`确定要删除环境「${env.name}」吗？此操作不可撤销。`}
                    confirmText="删除"
                    danger
                    onConfirm={() => handleDeleteEnv(env.id)}
                  >
                    <Button
                      variant="ghost" size="icon"
                      onClick={e => e.stopPropagation()}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </ConfirmDialog>
                </div>
              ) : null}
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {selectedEnv ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" style={{ color: selectedEnv.color }} />
                <h2 className="text-base font-semibold text-foreground">
                  {selectedEnv.name}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
                  {([
                    { value: 'resources', label: '资源视图', icon: Server },
                    { value: 'groups', label: '分组视图', icon: FolderTree },
                  ] as const).map((item) => {
                    const Icon = item.icon
                    const active = viewMode === item.value
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setViewMode(item.value)}
                        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: active ? 'var(--color-card)' : 'transparent',
                          color: active ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </button>
                    )
                  })}
                </div>
                {!isReadOnly && viewMode === 'groups' ? (
                  <Button variant="secondary" size="sm" onClick={() => {
                    setEditingGroup(null)
                    setShowGroupForm(true)
                  }}>
                    <Plus className="w-3.5 h-3.5" /> 新建分组
                  </Button>
                ) : null}
              </div>
            </div>

            {viewMode === 'resources' ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="text-xs text-muted-foreground">当前环境资源数</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{resourceSummary.total}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="text-xs text-muted-foreground">分组数量</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{resourceSummary.groups}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="text-xs text-muted-foreground">已绑定凭据</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{resourceSummary.credentials}</div>
                  </div>
                </div>

                {assetsLoading ? (
                  <div className="flex-1 flex items-center justify-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
                    正在加载环境资源...
                  </div>
                ) : envAssets.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                    当前环境还没有资源
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="min-w-[920px] w-full text-sm">
                      <thead>
                        <tr className="bg-secondary border-b border-border">
                          {['资源名称', '分组', '类型', '连接地址', '凭据', '状态'].map((header) => (
                            <th key={header} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {envAssets.map((asset) => (
                          <tr key={asset.id} className="border-t border-border bg-card hover:bg-accent/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground">{asset.name}</div>
                              {asset.description ? <div className="mt-1 text-xs text-muted-foreground">{asset.description}</div> : null}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{asset.group?.name ?? '未分组'}</td>
                            <td className="px-4 py-3">
                              <div className="text-foreground">{CATEGORY_LABELS[asset.category] ?? asset.category}</div>
                              <div className="text-xs text-muted-foreground">{asset.plugin_type}</div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{getAssetAddress(asset)}</td>
                            <td className="px-4 py-3">
                              {asset.credential ? (
                                <div className="flex items-center gap-2 text-sm text-foreground">
                                  <KeyRound className="h-3.5 w-3.5 text-blue-400" />
                                  <span>{asset.credential.name}</span>
                                  <span className="text-xs text-muted-foreground">{CREDENTIAL_TYPE_LABELS[asset.credential.type]}</span>
                                </div>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3"><StatusBadge status={asset.status as any} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : groups.length === 0 ? (
              <div className="flex-1 flex items-center justify-center border border-dashed border-border rounded-lg text-sm text-muted-foreground">
                暂无分组，点击「新建分组」添加
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {groups.map(g => (
                  <div key={g.id} className="group p-4 rounded-lg border bg-card border-border hover:border-primary/30 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{g.name}</div>
                        {g.description && (
                          <div className="text-xs mt-1 text-muted-foreground line-clamp-2">{g.description}</div>
                        )}
                      </div>
                      {!isReadOnly ? (
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                          <Button variant="ghost" size="icon"
                            onClick={() => {
                              setEditingGroup(g)
                              setShowGroupForm(true)
                            }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <ConfirmDialog
                            title="删除分组"
                            description={`确定要删除分组「${g.name}」吗？`}
                            confirmText="删除" danger onConfirm={() => handleDeleteGroup(g.id)}
                          >
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </ConfirmDialog>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center border border-dashed border-border rounded-lg text-sm text-muted-foreground">
            ← 选择左侧环境查看资源或分组
          </div>
        )}
      </div>

      <Modal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="导出环境资源"
        className="max-w-lg"
        footer={(
          <>
            <Button variant="outline" onClick={() => setShowExportModal(false)}>取消</Button>
            <Button onClick={() => void handleExportWorkbook()} loading={exporting}>导出 Excel</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-background/60 p-3 text-sm text-muted-foreground">
            将导出一个 Excel 工作簿，包含总览页以及每个环境独立的 sheet，便于按环境交付和归档。
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
            <div>
              <div className="text-sm font-medium text-foreground">包含敏感字段</div>
              <div className="text-xs text-muted-foreground">额外导出登录用户名、密码/密钥以及完整连接配置 JSON</div>
            </div>
            <Switch
              checked={includeSensitive}
              onCheckedChange={(checked) => {
                if (checked && isReadOnly) {
                  promptUnlock('解锁后才能导出包含账号密码和完整连接配置的 Excel。')
                  return
                }
                setIncludeSensitive(checked)
              }}
            />
          </div>

          {isReadOnly ? (
            <div className="rounded-lg border border-amber-300/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-700">
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert className="h-4 w-4" />
                当前为只读模式
              </div>
              <div className="mt-1 text-xs leading-5">
                现在仍可导出基础资源清单；若需要在 Excel 中包含用户名、密码或完整连接信息，请先解锁主密码。
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <EnvFormModal
        open={showEnvForm}
        env={editingEnv}
        onClose={() => setShowEnvForm(false)}
        onSave={async (data) => {
          try {
            if (editingEnv) {
              await environmentService.update({ id: editingEnv.id, ...data })
              toast.success('环境已更新')
            } else {
              await environmentService.create(data)
              toast.success('环境已创建')
            }
            await loadEnvironments()
            setShowEnvForm(false)
          } catch (e: any) {
            toast.error('保存失败', { description: e.message })
          }
        }}
      />

      {selectedEnv && (
        <GroupFormModal
          open={showGroupForm}
          group={editingGroup}
          onClose={() => setShowGroupForm(false)}
          onSave={async (data) => {
            try {
              if (editingGroup) {
                await groupService.update({ id: editingGroup.id, ...data })
                toast.success('分组已更新')
              } else {
                await groupService.create({ environment_id: selectedEnv.id, ...data })
                toast.success('分组已创建')
              }
              setGroups(await groupService.listByEnvironment(selectedEnv.id) as Group[])
              setShowGroupForm(false)
            } catch (e: any) {
              toast.error('保存失败', { description: e.message })
            }
          }}
        />
      )}
    </div>
  )
}

function EnvFormModal({
  open, env, onClose, onSave,
}: {
  open: boolean
  env: Environment | null
  onClose: () => void
  onSave: (data: { name: string; description: string; color: string }) => Promise<void>
}) {
  const [name, setName] = useState(env?.name ?? '')
  const [description, setDescription] = useState(env?.description ?? '')
  const [color, setColor] = useState(env?.color ?? ENV_COLORS[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(env?.name ?? '')
      setDescription(env?.description ?? '')
      setColor(env?.color ?? ENV_COLORS[0])
    }
  }, [open, env])

  const handleSubmit = async () => {
    if (!name.trim()) { toast.warning('环境名称不能为空'); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description, color })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={env ? '编辑环境' : '新建环境'}
      className="max-w-sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} loading={saving}>保存</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="环境名称" required>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="例如：生产环境" />
        </FormField>
        <FormField label="描述">
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="可选" />
        </FormField>
        <FormField label="标识颜色">
          <div className="flex gap-2 flex-wrap pt-0.5">
            {ENV_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full transition-transform focus-visible:outline-none"
                style={{
                  backgroundColor: c,
                  transform: color === c ? 'scale(1.3)' : 'scale(1)',
                  boxShadow: color === c ? `0 0 0 2px var(--color-background), 0 0 0 4px ${c}` : 'none',
                }}
              />
            ))}
          </div>
        </FormField>
      </div>
    </Modal>
  )
}

function GroupFormModal({
  open, group, onClose, onSave,
}: {
  open: boolean
  group: Group | null
  onClose: () => void
  onSave: (data: { name: string; description: string }) => Promise<void>
}) {
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(group?.name ?? '')
      setDescription(group?.description ?? '')
    }
  }, [open, group])

  const handleSubmit = async () => {
    if (!name.trim()) { toast.warning('分组名称不能为空'); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={group ? '编辑分组' : '新建分组'}
      className="max-w-sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} loading={saving}>保存</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="分组名称" required>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="例如： Web 层" />
        </FormField>
        <FormField label="描述">
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="可选" />
        </FormField>
      </div>
    </Modal>
  )
}

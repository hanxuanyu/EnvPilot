// EnvironmentPage.tsx — 环境管理页面（重新设计）
import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Pencil, Trash2, Layers, ChevronRight, RefreshCw, Download,
  Server, FolderTree, KeyRound, ShieldAlert, Search, Activity, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAssetStore } from '@/store/assetStore'
import { useAuth } from '@/components/common/AuthProvider'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal, FormField } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/common/StatusBadge'
import { HealthMetricBadges } from '@/components/common/HealthMetricBadges'
import { assetService, credentialService, environmentService, groupService } from '@/services/assetService'
import { healthService } from '@/services/healthService'
import type { Asset, AssetCategory, Credential, Environment, Group } from '@/types/asset'
import { CATEGORY_LABELS, CATEGORY_COLORS, CREDENTIAL_TYPE_LABELS, getAssetAddress } from '@/types/asset'
import type { HealthSnapshot, HealthSummary } from '@/types/health'

const ENV_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
]

type TabType = 'overview' | 'assets' | 'groups'

export default function EnvironmentPage() {
  const { isReadOnly, promptUnlock } = useAuth()
  const { environments, loading, loadEnvironments } = useAssetStore()

  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  // 环境下的数据
  const [envAssets, setEnvAssets] = useState<Asset[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null)
  const [healthByAssetId, setHealthByAssetId] = useState<Record<number, HealthSnapshot>>({})
  const [dataLoading, setDataLoading] = useState(false)
  const [checkingAll, setCheckingAll] = useState(false)
  const [checkingAssetId, setCheckingAssetId] = useState<number | null>(null)

  // 资产 tab 筛选
  const [assetKeyword, setAssetKeyword] = useState('')
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<AssetCategory | ''>('')

  // 弹窗状态
  const [showEnvForm, setShowEnvForm] = useState(false)
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [includeSensitive, setIncludeSensitive] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [envDeleteDialog, setEnvDeleteDialog] = useState<{ open: boolean; env: Environment | null; assets: Asset[] }>({
    open: false, env: null, assets: [],
  })

  useEffect(() => { loadEnvironments() }, [])

  // 选中第一个环境
  useEffect(() => {
    if (environments.length === 0) { setSelectedEnv(null); return }
    if (!selectedEnv) { setSelectedEnv(environments[0]); return }
    const matched = environments.find(e => e.id === selectedEnv.id)
    if (!matched) setSelectedEnv(environments[0])
    else if (matched !== selectedEnv) setSelectedEnv(matched)
  }, [environments])

  // 切换环境时加载数据
  useEffect(() => {
    if (!selectedEnv) {
      setEnvAssets([]); setGroups([]); setHealthSummary(null); setHealthByAssetId({})
      return
    }
    loadEnvData(selectedEnv.id)
  }, [selectedEnv])

  const loadEnvData = async (envId: number) => {
    setDataLoading(true)
    try {
      const [assetList, groupList, summary] = await Promise.all([
        assetService.list({ environment_id: envId }) as Promise<Asset[]>,
        groupService.listByEnvironment(envId) as Promise<Group[]>,
        healthService.getSummary({ environment_id: envId }) as Promise<HealthSummary>,
      ])
      setEnvAssets(assetList as Asset[])
      setGroups(groupList as Group[])
      setHealthSummary(summary as HealthSummary)

      // 加载健康快照
      if (assetList.length > 0) {
        const snapshots = await healthService.listSnapshots({
          environment_id: envId,
          limit: Math.max(assetList.length * 3, 100),
          offset: 0,
        }) as { items: HealthSnapshot[] }
        const latest: Record<number, HealthSnapshot> = {}
        snapshots.items?.forEach(s => {
          const cur = latest[s.asset_id]
          if (!cur || new Date(s.checked_at) > new Date(cur.checked_at)) latest[s.asset_id] = s
        })
        setHealthByAssetId(latest)
      }
    } catch (e: any) {
      toast.error('加载环境数据失败', { description: e.message })
    } finally {
      setDataLoading(false)
    }
  }

  const handleRefresh = async () => {
    await loadEnvironments()
    if (selectedEnv) await loadEnvData(selectedEnv.id)
  }

  const handleCheckAll = async () => {
    if (!selectedEnv) return
    setCheckingAll(true)
    try {
      await healthService.checkAll({ environment_id: selectedEnv.id })
      toast.success('全部检查已完成')
      await loadEnvData(selectedEnv.id)
    } catch (e: any) {
      toast.error('检查失败', { description: e.message })
    } finally {
      setCheckingAll(false)
    }
  }

  const handleCheckAsset = async (assetId: number) => {
    setCheckingAssetId(assetId)
    try {
      await healthService.checkAsset(assetId)
      if (selectedEnv) await loadEnvData(selectedEnv.id)
    } catch (e: any) {
      toast.error('检查失败', { description: e.message })
    } finally {
      setCheckingAssetId(null)
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

  const requestDeleteEnv = async (env: Environment) => {
    const assets = await assetService.list({ environment_id: env.id }) as Asset[]
    setEnvDeleteDialog({ open: true, env, assets })
  }

  const handleDeleteEnv = async (id: number) => {
    try {
      await environmentService.delete(id)
      toast.success('环境已删除')
      setEnvDeleteDialog({ open: false, env: null, assets: [] })
      if (selectedEnv?.id === id) setSelectedEnv(null)
      await loadEnvironments()
    } catch (e: any) {
      toast.error('删除失败', { description: e.message })
    }
  }

  const handleExport = async () => {
    if (includeSensitive && isReadOnly) {
      promptUnlock('解锁后才能导出包含账号密码的 Excel。')
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
        const ids = Array.from(new Set(allAssets.map(a => a.credential_id).filter((v): v is number => !!v)))
        for (const id of ids) secretsByCredentialId[id] = await credentialService.reveal(id)
      }
      const saved = await downloadAssetsWorkbook({
        fileName: makeWorkbookFileName('环境资源清单'),
        assets: allAssets, credentials, secretsByCredentialId,
        environments, includeSensitive, exportMode: 'environment',
      })
      if (saved) { setShowExportModal(false); toast.success(`已导出 ${environments.length} 个环境的资源清单`) }
    } catch (e: any) {
      toast.error('导出失败', { description: e.message })
    } finally {
      setExporting(false)
    }
  }

  // 资产 tab 过滤
  const filteredAssets = useMemo(() => {
    let list = envAssets
    if (assetCategoryFilter) list = list.filter(a => a.category === assetCategoryFilter)
    if (assetKeyword.trim()) {
      const kw = assetKeyword.trim().toLowerCase()
      list = list.filter(a => a.name.toLowerCase().includes(kw) || getAssetAddress(a).toLowerCase().includes(kw))
    }
    return list
  }, [envAssets, assetCategoryFilter, assetKeyword])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    envAssets.forEach(a => { counts[a.category] = (counts[a.category] ?? 0) + 1 })
    return counts
  }, [envAssets])

  const uniqueCredentialCount = useMemo(
    () => new Set(envAssets.map(a => a.credential_id).filter(Boolean)).size,
    [envAssets],
  )

  return (
    <div className="flex gap-0 h-full animate-in fade-in-0 duration-200">
      {/* ── 左侧环境列表 ── */}
      <div className="w-64 flex flex-col gap-0 flex-shrink-0 border-r border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">环境列表</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" title="刷新" disabled={loading} onClick={() => void handleRefresh()}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" title="导出 Excel" onClick={() => setShowExportModal(true)}>
              <Download className="w-3.5 h-3.5" />
            </Button>
            {!isReadOnly && (
              <Button variant="ghost" size="icon" title="新建环境" onClick={() => { setEditingEnv(null); setShowEnvForm(true) }}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {environments.length === 0 ? (
            <div className="text-center py-12 text-xs text-muted-foreground">暂无环境</div>
          ) : environments.map(env => (
            <div
              key={env.id}
              onClick={() => setSelectedEnv(env)}
              className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all border"
              style={{
                backgroundColor: selectedEnv?.id === env.id ? 'var(--color-accent)' : 'transparent',
                borderColor: selectedEnv?.id === env.id ? env.color + '60' : 'transparent',
              }}
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: env.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-foreground">{env.name}</div>
                {env.description && (
                  <div className="text-xs truncate text-muted-foreground">{env.description}</div>
                )}
              </div>
              {!isReadOnly && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); setEditingEnv(env); setShowEnvForm(true) }}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); void requestDeleteEnv(env) }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
              <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0 opacity-50" />
            </div>
          ))}
        </div>
      </div>

      {/* ── 右侧详情面板 ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedEnv ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            ← 选择左侧环境查看详情
          </div>
        ) : (
          <>
            {/* 环境标题栏 */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedEnv.color }} />
                <h2 className="text-base font-semibold text-foreground">{selectedEnv.name}</h2>
                {selectedEnv.description && (
                  <span className="text-sm text-muted-foreground">{selectedEnv.description}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeTab === 'overview' && !isReadOnly && (
                  <Button variant="outline" size="sm" onClick={() => void handleCheckAll()} loading={checkingAll}>
                    <Activity className="w-3.5 h-3.5" />
                    全部检查
                  </Button>
                )}
                {activeTab === 'groups' && !isReadOnly && (
                  <Button variant="outline" size="sm" onClick={() => { setEditingGroup(null); setShowGroupForm(true) }}>
                    <Plus className="w-3.5 h-3.5" />
                    新建分组
                  </Button>
                )}
              </div>
            </div>

            {/* Tab 导航 */}
            <div className="flex items-center gap-0 border-b border-border px-6 flex-shrink-0">
              {([
                { key: 'overview', label: '概览', icon: Layers },
                { key: 'assets', label: `资产 (${envAssets.length})`, icon: Server },
                { key: 'groups', label: `分组 (${groups.length})`, icon: FolderTree },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
                  style={{
                    borderBottomColor: activeTab === key ? selectedEnv.color : 'transparent',
                    color: activeTab === key ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab 内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              {dataLoading ? (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">正在加载...</div>
              ) : (
                <>
                  {activeTab === 'overview' && (
                    <OverviewTab
                      envAssets={envAssets}
                      groups={groups}
                      healthSummary={healthSummary}
                      categoryCounts={categoryCounts}
                      uniqueCredentialCount={uniqueCredentialCount}
                    />
                  )}
                  {activeTab === 'assets' && (
                    <AssetsTab
                      assets={filteredAssets}
                      allAssets={envAssets}
                      keyword={assetKeyword}
                      categoryFilter={assetCategoryFilter}
                      healthByAssetId={healthByAssetId}
                      checkingAssetId={checkingAssetId}
                      isReadOnly={isReadOnly}
                      onKeywordChange={setAssetKeyword}
                      onCategoryChange={setAssetCategoryFilter}
                      onCheckAsset={handleCheckAsset}
                    />
                  )}
                  {activeTab === 'groups' && (
                    <GroupsTab
                      groups={groups}
                      assets={envAssets}
                      isReadOnly={isReadOnly}
                      onEditGroup={g => { setEditingGroup(g); setShowGroupForm(true) }}
                      onDeleteGroup={handleDeleteGroup}
                    />
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── 弹窗 ── */}
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

      {/* 删除环境确认 */}
      <Modal
        open={envDeleteDialog.open}
        onClose={() => setEnvDeleteDialog({ open: false, env: null, assets: [] })}
        title={envDeleteDialog.assets.length > 0 ? '无法删除环境' : '删除环境'}
        className="max-w-xl"
        footer={(
          <>
            <Button variant="outline" onClick={() => setEnvDeleteDialog({ open: false, env: null, assets: [] })}>取消</Button>
            {envDeleteDialog.assets.length === 0 && envDeleteDialog.env && (
              <Button variant="destructive" onClick={() => void handleDeleteEnv(envDeleteDialog.env!.id)}>删除</Button>
            )}
          </>
        )}
      >
        <div className="space-y-4 text-sm text-muted-foreground">
          {envDeleteDialog.assets.length > 0 ? (
            <>
              <div className="rounded-lg border border-amber-300/40 bg-amber-500/5 px-4 py-3 text-amber-700">
                环境「{envDeleteDialog.env?.name}」下仍存在 {envDeleteDialog.assets.length} 个资产，请先清空后再删除。
              </div>
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {envDeleteDialog.assets.map(a => (
                  <div key={a.id} className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
                    {a.group?.name ? `${a.group.name} / ` : ''}{a.name}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div>确定要删除环境「{envDeleteDialog.env?.name}」吗？此操作不可撤销。</div>
          )}
        </div>
      </Modal>

      {/* 导出弹窗 */}
      <Modal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="导出环境资源"
        className="max-w-lg"
        footer={(
          <>
            <Button variant="outline" onClick={() => setShowExportModal(false)}>取消</Button>
            <Button onClick={() => void handleExport()} loading={exporting}>导出 Excel</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-background/60 p-3 text-sm text-muted-foreground">
            将导出一个 Excel 工作簿，包含总览页以及每个环境独立的 sheet。
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
            <div>
              <div className="text-sm font-medium text-foreground">包含敏感字段</div>
              <div className="text-xs text-muted-foreground">额外导出登录用户名、密码/密钥以及完整连接配置</div>
            </div>
            <Switch checked={includeSensitive} onCheckedChange={checked => {
              if (checked && isReadOnly) { promptUnlock('解锁后才能导出敏感信息。'); return }
              setIncludeSensitive(checked)
            }} />
          </div>
          {isReadOnly && (
            <div className="rounded-lg border border-amber-300/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-700">
              <div className="flex items-center gap-2 font-medium"><ShieldAlert className="h-4 w-4" />当前为只读模式</div>
              <div className="mt-1 text-xs">可导出基础清单；如需包含密码，请先解锁。</div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

// ── 概览 Tab ──────────────────────────────────────────────────────

function OverviewTab({ envAssets, groups, healthSummary, categoryCounts, uniqueCredentialCount }: {
  envAssets: Asset[]
  groups: Group[]
  healthSummary: HealthSummary | null
  categoryCounts: Record<string, number>
  uniqueCredentialCount: number
}) {
  const healthCards = [
    { label: '健康', key: 'healthy', color: '#22c55e' },
    { label: '告警', key: 'warning', color: '#f59e0b' },
    { label: '严重', key: 'critical', color: '#ef4444' },
    { label: '不可达', key: 'unreachable', color: '#6b7280' },
  ] as const

  return (
    <div className="space-y-6">
      {/* 健康状态 */}
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">健康状态</div>
        <div className="grid grid-cols-4 gap-3">
          {healthCards.map(({ label, key, color }) => (
            <div key={key} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <div className="text-2xl font-semibold text-foreground">
                {healthSummary ? (healthSummary as any)[key] ?? 0 : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 资产分类 */}
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">资产分类</div>
        <div className="grid grid-cols-5 gap-3">
          {(Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]).map(cat => (
            <div key={cat} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[cat]}</span>
              </div>
              <div className="text-2xl font-semibold text-foreground">{categoryCounts[cat] ?? 0}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 汇总统计 */}
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">汇总</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-2">资产总数</div>
            <div className="text-2xl font-semibold text-foreground">{envAssets.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-2">分组数量</div>
            <div className="text-2xl font-semibold text-foreground">{groups.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-2">已绑定凭据</div>
            <div className="text-2xl font-semibold text-foreground">{uniqueCredentialCount}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 资产 Tab ──────────────────────────────────────────────────────

function AssetsTab({ assets, allAssets, keyword, categoryFilter, healthByAssetId, checkingAssetId, isReadOnly, onKeywordChange, onCategoryChange, onCheckAsset }: {
  assets: Asset[]
  allAssets: Asset[]
  keyword: string
  categoryFilter: AssetCategory | ''
  healthByAssetId: Record<number, HealthSnapshot>
  checkingAssetId: number | null
  isReadOnly: boolean
  onKeywordChange: (v: string) => void
  onCategoryChange: (v: AssetCategory | '') => void
  onCheckAsset: (id: number) => void
}) {
  const categories = Object.keys(CATEGORY_LABELS) as AssetCategory[]

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
          <button
            type="button"
            onClick={() => onCategoryChange('')}
            className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
            style={{
              backgroundColor: !categoryFilter ? 'var(--color-card)' : 'transparent',
              color: !categoryFilter ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
            }}
          >
            全部 ({allAssets.length})
          </button>
          {categories.map(cat => {
            const count = allAssets.filter(a => a.category === cat).length
            if (count === 0) return null
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  backgroundColor: categoryFilter === cat ? 'var(--color-card)' : 'transparent',
                  color: categoryFilter === cat ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
                }}
              >
                {CATEGORY_LABELS[cat]} ({count})
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <input
            value={keyword}
            onChange={e => onKeywordChange(e.target.value)}
            placeholder="搜索资产名称或地址..."
            className="flex-1 py-2 text-sm outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* 资产表格 */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-[900px] w-full text-sm">
          <thead>
            <tr className="bg-secondary border-b border-border">
              {['资产名称', '分组', '类型', '连接地址', '凭据', '状态', '健康', ...(!isReadOnly ? ['操作'] : [])].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr>
                <td colSpan={isReadOnly ? 7 : 8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  暂无资产
                </td>
              </tr>
            ) : assets.map(asset => (
              <tr key={asset.id} className="border-t border-border bg-card hover:bg-accent/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{asset.name}</div>
                  {asset.tags?.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {asset.tags.map(t => <Badge key={t} variant="outline" className="text-[10px] h-4 px-1.5">{t}</Badge>)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{asset.group?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="text-xs px-2 py-0.5 rounded-full font-medium w-fit"
                    style={{ backgroundColor: (CATEGORY_COLORS[asset.category as AssetCategory] ?? '#6b7280') + '20', color: CATEGORY_COLORS[asset.category as AssetCategory] ?? '#6b7280' }}>
                    {CATEGORY_LABELS[asset.category as AssetCategory] ?? asset.category}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{asset.plugin_type}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-[200px] truncate">{getAssetAddress(asset)}</td>
                <td className="px-4 py-3">
                  {asset.credential ? (
                    <div className="flex items-center gap-1.5 text-xs text-foreground">
                      <KeyRound className="h-3 w-3 text-blue-400" />
                      <span>{asset.credential.name}</span>
                    </div>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={asset.status as any} /></td>
                <td className="px-4 py-3 max-w-[280px]">
                  <HealthMetricBadges snapshot={healthByAssetId[asset.id]} emptyText="未检查" />
                </td>
                {!isReadOnly && (
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost" size="sm"
                      loading={checkingAssetId === asset.id}
                      onClick={() => onCheckAsset(asset.id)}
                    >
                      检查
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── 分组 Tab ──────────────────────────────────────────────────────

function GroupsTab({ groups, assets, isReadOnly, onEditGroup, onDeleteGroup }: {
  groups: Group[]
  assets: Asset[]
  isReadOnly: boolean
  onEditGroup: (g: Group) => void
  onDeleteGroup: (id: number) => void
}) {
  const ungrouped = assets.filter(a => !a.group_id)

  return (
    <div className="space-y-3">
      {groups.length === 0 && ungrouped.length === 0 && (
        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          暂无分组，点击右上角「新建分组」添加
        </div>
      )}

      {groups.map(g => {
        const groupAssets = assets.filter(a => a.group_id === g.id)
        return (
          <div key={g.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/40">
              <div className="flex items-center gap-3">
                <FolderTree className="w-4 h-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium text-foreground">{g.name}</span>
                  {g.description && <span className="ml-2 text-xs text-muted-foreground">{g.description}</span>}
                </div>
                <Badge variant="secondary" className="text-xs">{groupAssets.length} 个资产</Badge>
              </div>
              {!isReadOnly && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditGroup(g)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <ConfirmDialog
                    title="删除分组"
                    description={`确定要删除分组「${g.name}」吗？${groupAssets.length > 0 ? `该分组下有 ${groupAssets.length} 个资产，删除后这些资产将变为未分组。` : ''}`}
                    confirmText="删除" danger onConfirm={() => onDeleteGroup(g.id)}
                  >
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </ConfirmDialog>
                </div>
              )}
            </div>
            {groupAssets.length > 0 ? (
              <div className="divide-y divide-border">
                {groupAssets.map(asset => (
                  <div key={asset.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Server className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">{asset.name}</span>
                    <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[asset.category as AssetCategory] ?? asset.category}</span>
                    <span className="font-mono text-xs text-muted-foreground">{getAssetAddress(asset)}</span>
                    <StatusBadge status={asset.status as any} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">该分组下暂无资产</div>
            )}
          </div>
        )
      })}

      {ungrouped.length > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3">
              <FolderTree className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">未分组</span>
              <Badge variant="outline" className="text-xs">{ungrouped.length} 个资产</Badge>
            </div>
          </div>
          <div className="divide-y divide-border">
            {ungrouped.map(asset => (
              <div key={asset.id} className="flex items-center gap-3 px-4 py-2.5">
                <Server className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">{asset.name}</span>
                <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[asset.category as AssetCategory] ?? asset.category}</span>
                <span className="font-mono text-xs text-muted-foreground">{getAssetAddress(asset)}</span>
                <StatusBadge status={asset.status as any} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 环境表单弹窗 ──────────────────────────────────────────────────

function EnvFormModal({ open, env, onClose, onSave }: {
  open: boolean
  env: Environment | null
  onClose: () => void
  onSave: (data: { name: string; description: string; color: string }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(ENV_COLORS[0])
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
    try { await onSave({ name: name.trim(), description, color }) }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={env ? '编辑环境' : '新建环境'} className="max-w-sm"
      footer={<><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={handleSubmit} loading={saving}>保存</Button></>}
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
              <button key={c} type="button" onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full transition-transform focus-visible:outline-none"
                style={{ backgroundColor: c, transform: color === c ? 'scale(1.3)' : 'scale(1)', boxShadow: color === c ? `0 0 0 2px var(--color-background), 0 0 0 4px ${c}` : 'none' }}
              />
            ))}
          </div>
        </FormField>
      </div>
    </Modal>
  )
}

// ── 分组表单弹窗 ──────────────────────────────────────────────────

function GroupFormModal({ open, group, onClose, onSave }: {
  open: boolean
  group: Group | null
  onClose: () => void
  onSave: (data: { name: string; description: string }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setName(group?.name ?? ''); setDescription(group?.description ?? '') }
  }, [open, group])

  const handleSubmit = async () => {
    if (!name.trim()) { toast.warning('分组名称不能为空'); return }
    setSaving(true)
    try { await onSave({ name: name.trim(), description }) }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={group ? '编辑分组' : '新建分组'} className="max-w-sm"
      footer={<><Button variant="outline" onClick={onClose}>取消</Button><Button onClick={handleSubmit} loading={saving}>保存</Button></>}
    >
      <div className="space-y-4">
        <FormField label="分组名称" required>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="例如：Web 层" />
        </FormField>
        <FormField label="描述">
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="可选" />
        </FormField>
      </div>
    </Modal>
  )
}

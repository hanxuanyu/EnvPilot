// AssetPage.tsx — 资产列表页面
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  Plus, Search, Server, Database, Zap, Send, Box,
  Trash2, Pencil, KeyRound, RefreshCw, Download, Upload, type LucideProps,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/components/common/AuthProvider'
import { CopyButton } from '@/components/common/CopyButton'
import { useAssetStore } from '@/store/assetStore'
import { StatusBadge } from '@/components/common/StatusBadge'
import { HealthMetricBadges } from '@/components/common/HealthMetricBadges'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DynamicConfigForm } from '@/components/asset/DynamicConfigForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Modal,
  FormField,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { assetService, credentialService, environmentService, groupService } from '@/services/assetService'
import { dnsService } from '@/services/dnsService'
import { healthService } from '@/services/healthService'
import type {
  Asset, Credential, AssetCategory, CredentialType, PluginDef, Environment, Group,
} from '@/types/asset'
import type { DNSRecord } from '@/types/dns'
import type { HealthSnapshot } from '@/types/health'
import {
  CATEGORY_LABELS, CATEGORY_COLORS, ASSET_STATUS_LABELS, ASSET_STATUS_COLORS,
  CREDENTIAL_TYPE_LABELS,
  getAssetAddress,
} from '@/types/asset'
import type { AssetExportMode } from '@/lib/assetWorkbook'

// ── 图标映射 ──

const CATEGORY_ICONS: Record<AssetCategory, React.FC<LucideProps>> = {
  server: Server,
  database: Database,
  cache: Zap,
  mq: Send,
  other: Box,
}

type TabType = 'assets' | 'credentials'

type CredentialDeleteDialogState = {
  open: boolean
  credential: Credential | null
  assetNames: string[]
}

// ── 主页面 ──

export default function AssetPage() {
  const { isReadOnly, promptUnlock, status } = useAuth()
  const [searchParams] = useSearchParams()
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const {
    environments, assets, credentials, plugins,
    selectedEnvId, loading,
    loadEnvironments, loadAssets, loadCredentials, loadPlugins,
    setSelectedEnv,
  } = useAssetStore()

  const handleRefresh = async () => {
    if (tab === 'assets') {
      await Promise.all([
        loadEnvironments(),
        loadAssets({
          environment_id: selectedEnvId ?? undefined,
          category: categoryFilter || undefined,
          plugin_type: pluginFilter || undefined,
          keyword: appliedKeyword || undefined,
        }),
        loadCredentials(),
        loadPlugins(),
      ])
    } else {
      await loadCredentials()
    }
  }

  const [tab, setTab] = useState<TabType>('assets')
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [credentialKeyword, setCredentialKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | ''>('')
  const [pluginFilter, setPluginFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState<number | ''>('')
  const [tagFilter, setTagFilter] = useState('')
  const [filterGroups, setFilterGroups] = useState<Group[]>([])

  const [showAssetForm, setShowAssetForm] = useState(false)
  const [showCredForm, setShowCredForm] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [editingCred, setEditingCred] = useState<Credential | null>(null)
  const [credentialDeleteDialog, setCredentialDeleteDialog] = useState<CredentialDeleteDialogState>({
    open: false,
    credential: null,
    assetNames: [],
  })
  const [credentialDeleteLoadingId, setCredentialDeleteLoadingId] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [includeSensitive, setIncludeSensitive] = useState(false)
  const [exportMode, setExportMode] = useState<AssetExportMode>('current')
  const [healthByAssetId, setHealthByAssetId] = useState<Record<number, HealthSnapshot>>({})
  const highlightedAssetId = Number(searchParams.get('asset') || 0)
  const highlightedCredentialId = Number(searchParams.get('credential') || 0)

  useEffect(() => {
    loadEnvironments()
    loadAssets()
    loadCredentials()
    loadPlugins()
  }, [])

  useEffect(() => {
    const nextTab = searchParams.get('tab')
    const nextKeyword = searchParams.get('keyword') ?? ''
    const nextCategory = searchParams.get('category') as AssetCategory | null
    const nextPlugin = searchParams.get('plugin') ?? ''
    const nextEnv = searchParams.get('env')

    if (nextTab === 'credentials') {
      setTab('credentials')
      setCredentialKeyword(nextKeyword)
      return
    }

    setTab('assets')
    setKeyword(nextKeyword)
    setAppliedKeyword(nextKeyword)
    setCategoryFilter(nextCategory ?? '')
    setPluginFilter(nextPlugin)
    setSelectedEnv(nextEnv ? Number(nextEnv) : null)

    void loadAssets({
      environment_id: nextEnv ? Number(nextEnv) : undefined,
      category: nextCategory || undefined,
      plugin_type: nextPlugin || undefined,
      keyword: nextKeyword || undefined,
    })
  }, [searchParams])

  useEffect(() => {
    if (highlightedAssetId <= 0) return
    const timer = window.setTimeout(() => {
      document.getElementById(`asset-row-${highlightedAssetId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [highlightedAssetId, assets.length])

  useEffect(() => {
    if (highlightedCredentialId <= 0) return
    const timer = window.setTimeout(() => {
      document.getElementById(`credential-row-${highlightedCredentialId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [highlightedCredentialId, credentials.length])

  useEffect(() => {
    if (tab !== 'assets') return
    loadAssets({
      environment_id: selectedEnvId ?? undefined,
      group_id: groupFilter || undefined,
      category: categoryFilter || undefined,
      plugin_type: pluginFilter || undefined,
      keyword: appliedKeyword || undefined,
      tag: tagFilter || undefined,
    })
  }, [tab, selectedEnvId, groupFilter, tagFilter, categoryFilter, pluginFilter, appliedKeyword])

  useEffect(() => {
    setGroupFilter('')
    if (!selectedEnvId) {
      setFilterGroups([])
      return
    }
    groupService.listByEnvironment(selectedEnvId)
      .then((list) => setFilterGroups(list as Group[]))
      .catch(() => setFilterGroups([]))
  }, [selectedEnvId])

  useEffect(() => {
    if (tab !== 'assets') return
    if (assets.length === 0) {
      setHealthByAssetId({})
      return
    }

    let cancelled = false

    const loadHealthSnapshots = async () => {
      try {
        const result = await healthService.listSnapshots({
          environment_id: selectedEnvId ?? undefined,
          category: categoryFilter || undefined,
          keyword: appliedKeyword || undefined,
          limit: Math.max(assets.length * 3, 100),
          offset: 0,
        })

        if (cancelled) return

        const visibleIds = new Set(assets.map((asset) => asset.id))
        const latestByAsset: Record<number, HealthSnapshot> = {}

        result.items.forEach((snapshot) => {
          if (!visibleIds.has(snapshot.asset_id)) return
          const current = latestByAsset[snapshot.asset_id]
          if (!current || new Date(snapshot.checked_at).getTime() > new Date(current.checked_at).getTime()) {
            latestByAsset[snapshot.asset_id] = snapshot
          }
        })

        setHealthByAssetId(latestByAsset)
      } catch {
        if (!cancelled) setHealthByAssetId({})
      }
    }

    loadHealthSnapshots()

    return () => {
      cancelled = true
    }
  }, [tab, assets, selectedEnvId, categoryFilter, appliedKeyword])

  const handleSearch = () => setAppliedKeyword(keyword.trim())

  const handleDeleteAsset = async (id: number, name: string) => {
    if (isReadOnly) {
      promptUnlock('当前为只读模式，解锁后才能删除资产。')
      return
    }
    try {
      await assetService.delete(id)
      toast.success(`资产「${name}」已删除`)
      await loadAssets()
    } catch (e: any) {
      toast.error('删除失败', { description: e.message })
    }
  }

  const resetCredentialDeleteDialog = () => {
    setCredentialDeleteDialog({
      open: false,
      credential: null,
      assetNames: [],
    })
  }

  const openCredentialDeleteDialog = async (credential: Credential) => {
    setCredentialDeleteLoadingId(credential.id)

    try {
      const assetNames = await credentialService.getBindings(credential.id)
      setCredentialDeleteDialog({
        open: true,
        credential,
        assetNames,
      })
    } catch (e: any) {
      resetCredentialDeleteDialog()
      toast.error('加载凭据绑定关系失败', { description: e?.message || '加载失败' })
    } finally {
      setCredentialDeleteLoadingId((current) => (current === credential.id ? null : current))
    }
  }

  const handleDeleteCred = async () => {
    if (isReadOnly) {
      promptUnlock('当前为只读模式，解锁后才能删除凭据。')
      return
    }
    const credential = credentialDeleteDialog.credential
    if (!credential) return
    try {
      await credentialService.delete(credential.id)
      toast.success(`凭据「${credential.name}」已删除`)
      resetCredentialDeleteDialog()
      await loadCredentials()
    } catch (e: any) {
      const message = e?.message || '删除失败'
      resetCredentialDeleteDialog()
      toast.error('删除失败', { description: message })
      return
    }
    setCredentialDeleteDialog((current) => ({ ...current, loading: false }))
  }

  const canIncludeSensitive = !status?.enabled || !isReadOnly || !!status?.unlocked
  const selectedEnvironment = environments.find((environment) => environment.id === selectedEnvId) ?? null

  const handleExportAssets = async () => {
    if (assets.length === 0) {
      toast.info('当前筛选条件下没有可导出的资源')
      return
    }

    if (includeSensitive && !canIncludeSensitive) {
      promptUnlock('解锁后才能导出包含用户名和明文凭据的资源清单。')
      return
    }

    if (exportMode === 'selected-environment' && !selectedEnvironment) {
      toast.info('请先在资产列表顶部选择一个环境，再导出当前环境资源')
      return
    }

    const targetAssets = exportMode === 'middleware'
      ? assets.filter((asset) => asset.category !== 'server')
      : exportMode === 'selected-environment' && selectedEnvironment
        ? assets.filter((asset) => asset.environment_id === selectedEnvironment.id)
      : assets

    if (targetAssets.length === 0) {
      toast.info(
        exportMode === 'middleware'
          ? '当前筛选条件下没有可导出的中间件资源'
          : exportMode === 'selected-environment'
            ? '当前环境下没有可导出的资源'
            : '当前筛选条件下没有可导出的资源',
      )
      return
    }

    setExporting(true)
    try {
      const { downloadAssetsWorkbook, makeWorkbookFileName } = await import('@/lib/assetWorkbook')
      const secretsByCredentialId: Record<number, string> = {}

      if (includeSensitive) {
        const credentialIDs = Array.from(new Set(targetAssets
          .map((asset) => asset.credential_id)
          .filter((value): value is number => !!value)))

        for (const credentialID of credentialIDs) {
          secretsByCredentialId[credentialID] = await credentialService.reveal(credentialID)
        }
      }

      const saved = await downloadAssetsWorkbook({
        fileName: makeWorkbookFileName(
          exportMode === 'environment'
            ? '资产列表-按环境'
            : exportMode === 'selected-environment'
              ? `资产列表-${selectedEnvironment?.name ?? '当前环境'}`
            : exportMode === 'middleware'
              ? '资产列表-按中间件类型'
              : '资产列表',
        ),
        assets: targetAssets,
        credentials,
        environments,
        plugins,
        includeSensitive,
        secretsByCredentialId,
        exportMode,
        selectedEnvironmentId: selectedEnvironment?.id,
        selectedEnvironmentName: selectedEnvironment?.name,
        sheetName: '当前列表',
      })
      if (saved) {
        setShowExportModal(false)
        toast.success(`已导出 ${targetAssets.length} 条资源`)
      }
    } catch (error: any) {
      toast.error('导出失败', { description: error.message })
    } finally {
      setExporting(false)
    }
  }

  const handleImportAssets = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (isReadOnly) {
      promptUnlock('当前为只读模式，解锁后才能批量导入资源。')
      return
    }

    setImporting(true)
    try {
      const { parseAssetImportFile } = await import('@/lib/assetWorkbook')
      const rows = await parseAssetImportFile(file)
      if (rows.length === 0) {
        toast.info('导入文件中没有可处理的资源行')
        return
      }

      const normalize = (value: string) => value.trim().toLowerCase()
      const envMap = new Map(environments.map((environment) => [normalize(environment.name), environment]))
      const credentialMap = new Map(credentials.map((credential) => [normalize(credential.name), credential]))
      const pluginMap = new Map(plugins.map((plugin) => [plugin.type_id, plugin]))
      const groupCache = new Map<number, Group[]>()
      const failures: string[] = []
      let successCount = 0

      const loadGroupsByEnvironment = async (environmentID: number) => {
        if (groupCache.has(environmentID)) return groupCache.get(environmentID) ?? []
        const groups = await groupService.listByEnvironment(environmentID) as Group[]
        groupCache.set(environmentID, groups)
        return groups
      }

      for (const row of rows) {
        try {
          const environment = envMap.get(normalize(row.environmentName))
          if (!environment) throw new Error(`环境「${row.environmentName}」不存在`)

          const plugin = pluginMap.get(row.pluginType)
          if (!plugin) throw new Error(`插件类型「${row.pluginType}」不存在`)
          if (plugin.category !== row.category) {
            throw new Error(`类别与插件类型不匹配，期望 ${plugin.category}`)
          }

          let groupID: number | undefined
          if (row.groupName) {
            const groups = await loadGroupsByEnvironment(environment.id)
            const group = groups.find((item) => normalize(item.name) === normalize(row.groupName))
            if (!group) throw new Error(`分组「${row.groupName}」不存在于环境「${environment.name}」`) 
            groupID = group.id
          }

          let credentialID: number | undefined
          if (row.credentialName) {
            const credential = credentialMap.get(normalize(row.credentialName))
            if (!credential) throw new Error(`凭据「${row.credentialName}」不存在`)
            credentialID = credential.id
          }

          await assetService.create({
            environment_id: environment.id,
            group_id: groupID,
            category: row.category,
            plugin_type: row.pluginType,
            name: row.assetName,
            description: row.description,
            tags: row.tags,
            credential_id: credentialID,
            ext_config: row.extConfig,
            dns_config: {
              enabled: row.dnsEnabled,
              domain: row.dnsEnabled ? row.dnsDomain : '',
              ttl: row.dnsTTL,
            },
          })
          successCount += 1
        } catch (error: any) {
          failures.push(`第 ${row.rowNumber} 行：${error.message}`)
        }
      }

      if (successCount > 0) {
        await handleRefresh()
      }

      if (failures.length === 0) {
        toast.success(`批量导入完成，共导入 ${successCount} 条资源`)
      } else {
        toast.warning(`批量导入完成，成功 ${successCount} 条，失败 ${failures.length} 条`, {
          description: failures.slice(0, 3).join('；'),
        })
      }
    } catch (error: any) {
      toast.error('导入失败', { description: error.message })
    } finally {
      setImporting(false)
    }
  }

  // 按 category 过滤可用插件
  const filteredPlugins = categoryFilter
    ? plugins.filter(p => p.category === categoryFilter)
    : plugins
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    assets.forEach(a => a.tags?.forEach(t => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [assets])
  const filteredCredentials = useMemo(() => {
    const value = credentialKeyword.trim().toLowerCase()
    if (!value) return credentials
    return credentials.filter((credential) => {
      const haystack = [credential.name, credential.username, credential.type, CREDENTIAL_TYPE_LABELS[credential.type], credential.secret_masked ?? '']
        .join(' ')
        .toLowerCase()
      return haystack.includes(value)
    })
  }, [credentialKeyword, credentials])

  return (
    <div className="w-full min-w-0 space-y-5 animate-in fade-in-0 duration-200">
      {isReadOnly ? (
        <div className="rounded-xl border border-amber-300/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-700">
          当前为只读模式。你仍可查看资产与凭据信息，但新增、编辑、删除和明文查看等操作需要先输入主密码。
        </div>
      ) : null}

      {/* 顶部 Tab + 操作按钮 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary">
          {(['assets', 'credentials'] as TabType[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: tab === t ? 'var(--color-card)' : 'transparent',
                color: tab === t ? 'var(--color-foreground)' : 'var(--color-muted-foreground)',
              }}
            >
              {t === 'assets' ? '资产列表' : '凭据管理'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === 'assets' ? (
            <>
              <Button variant="outline" size="sm" onClick={async () => {
                const { downloadAssetImportTemplate } = await import('@/lib/assetWorkbook')
              const saved = await downloadAssetImportTemplate()
              if (saved) {
                toast.success('资源导入模板已保存')
              }
              }}>
                <Download className="w-3.5 h-3.5" />
                下载模板
              </Button>
              {!isReadOnly ? (
                <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()} disabled={importing}>
                  <Upload className="w-3.5 h-3.5" />
                  {importing ? '导入中...' : '批量导入'}
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => setShowExportModal(true)} disabled={exporting}>
                <Download className="w-3.5 h-3.5" />
                导出列表
              </Button>
            </>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            title="刷新数据"
            disabled={loading}
            onClick={handleRefresh}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          {!isReadOnly ? (
            <Button onClick={() => {
              if (tab === 'assets') {
                setEditingAsset(null)
                setShowAssetForm(true)
              } else {
                setEditingCred(null)
                setShowCredForm(true)
              }
            }}>
              <Plus className="w-4 h-4" />
              {tab === 'assets' ? '添加资产' : '添加凭据'}
            </Button>
          ) : null}
        </div>
      </div>

      {/* 资产列表 Tab */}
      {tab === 'assets' && (
        <>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportAssets}
          />

          {/* 筛选栏 */}
          <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card p-3.5">
            <div className="w-full sm:w-[170px] lg:w-[180px]">
              <Select
                value={selectedEnvId?.toString() ?? '__all__'}
                onValueChange={v => setSelectedEnv(v === '__all__' ? null : Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部环境" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部环境</SelectItem>
                  {environments.map(e => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                        {e.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-[150px] lg:w-[160px]">
              <Select
                value={categoryFilter || '__all__'}
                onValueChange={v => {
                  setCategoryFilter(v === '__all__' ? '' : v as AssetCategory)
                  setPluginFilter('')
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部类别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部类别</SelectItem>
                  {(Object.keys(CATEGORY_LABELS) as AssetCategory[]).map(k => (
                    <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-[170px] lg:w-[180px]">
              <Select
                value={pluginFilter || '__all__'}
                onValueChange={v => setPluginFilter(v === '__all__' ? '' : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部类型</SelectItem>
                  {filteredPlugins.map(p => (
                    <SelectItem key={p.type_id} value={p.type_id}>{p.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEnvId && filterGroups.length > 0 && (
              <div className="w-full sm:w-[150px] lg:w-[160px]">
                <Select
                  value={groupFilter ? groupFilter.toString() : '__all__'}
                  onValueChange={v => setGroupFilter(v === '__all__' ? '' : Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="全部分组" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部分组</SelectItem>
                    {filterGroups.map(g => (
                      <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {allTags.length > 0 && (
              <div className="w-full sm:w-[150px] lg:w-[160px]">
                <Select
                  value={tagFilter || '__all__'}
                  onValueChange={v => setTagFilter(v === '__all__' ? '' : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="全部标签" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部标签</SelectItem>
                    {allTags.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex min-w-[220px] flex-1 basis-[260px] items-center gap-2 rounded-md border border-border bg-background px-3">
              <Search className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="搜索资产名称..."
                className="flex-1 py-2 text-sm outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Button variant="secondary" onClick={handleSearch} className="w-full sm:w-auto shrink-0">搜索</Button>
          </div>

          {/* 资产表格 */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-[1120px] w-full text-sm">
              <thead>
                <tr className="bg-secondary border-b border-border">
                  {['资产名称', '类型', '连接地址', '环境', '分组', '状态', '健康', ...(!isReadOnly ? ['操作'] : [])].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={isReadOnly ? 7 : 8} className="px-4 py-16 text-center text-sm text-muted-foreground">
                      暂无资产，点击「添加资产」开始
                    </td>
                  </tr>
                ) : assets.map(asset => {
                  const cat = asset.category as AssetCategory
                  const Icon = CATEGORY_ICONS[cat] ?? Box
                  const color = CATEGORY_COLORS[cat] ?? '#6b7280'
                  const plugin = plugins.find(p => p.type_id === asset.plugin_type)
                  const assetAddress = getAssetAddress(asset)
                  return (
                    <tr
                      id={`asset-row-${asset.id}`}
                      key={asset.id}
                      className="border-t border-border bg-card hover:bg-accent/30 transition-colors"
                      style={highlightedAssetId === asset.id ? { backgroundColor: 'color-mix(in srgb, var(--color-primary) 9%, var(--color-card))' } : undefined}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                          <span className="font-medium text-foreground">{asset.name}</span>
                        </div>
                        {asset.tags?.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {asset.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-[10px] h-4 px-1.5">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium w-fit"
                            style={{ backgroundColor: color + '20', color }}>
                            {CATEGORY_LABELS[cat]}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {plugin?.display_name ?? asset.plugin_type}
                          </span>
                        </div>
                      </td>
                      <td className="max-w-[280px] px-4 py-3 font-mono text-xs text-muted-foreground">
                        <div className="flex items-start gap-1.5">
                          <span className="min-w-0 break-all">{assetAddress}</span>
                          {assetAddress !== '—' && (
                            <CopyButton
                              text={assetAddress}
                              label="连接地址"
                              className="h-6 w-6 text-muted-foreground"
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {asset.environment && (
                          <span className="flex items-center gap-1.5 text-xs">
                            <span className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: asset.environment.color }} />
                            <span className="text-muted-foreground">{asset.environment.name}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {asset.group?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={asset.status as any} />
                      </td>
                      <td className="px-4 py-3 max-w-[320px]">
                        <HealthMetricBadges snapshot={healthByAssetId[asset.id]} emptyText="未检查" />
                      </td>
                      {!isReadOnly ? (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon"
                              onClick={() => { setEditingAsset(asset); setShowAssetForm(true) }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <ConfirmDialog
                              title="删除资产"
                              description={`确定要删除资产「${asset.name}」吗？此操作不可撤销。`}
                              confirmText="删除" danger
                              onConfirm={() => handleDeleteAsset(asset.id, asset.name)}
                            >
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </ConfirmDialog>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 凭据管理 Tab */}
      {tab === 'credentials' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3">
            <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <input
              value={credentialKeyword}
              onChange={(e) => setCredentialKeyword(e.target.value)}
              placeholder="搜索凭据名称、用户名或类型"
              className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="bg-secondary border-b border-border">
                {['名称', '类型', '用户名', '密钥', ...(!isReadOnly ? ['操作'] : [])].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCredentials.length === 0 ? (
                <tr>
                  <td colSpan={isReadOnly ? 4 : 5} className="px-4 py-16 text-center text-sm text-muted-foreground">
                    暂无匹配凭据
                  </td>
                </tr>
              ) : filteredCredentials.map(cred => (
                <tr
                  id={`credential-row-${cred.id}`}
                  key={cred.id}
                  className="border-t border-border bg-card hover:bg-accent/30 transition-colors"
                  style={highlightedCredentialId === cred.id ? { backgroundColor: 'color-mix(in srgb, var(--color-primary) 9%, var(--color-card))' } : undefined}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-blue-400" />
                      <span className="font-medium text-foreground">{cred.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {CREDENTIAL_TYPE_LABELS[cred.type]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{cred.username || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{cred.secret_masked}</td>
                  {!isReadOnly ? (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon"
                          onClick={() => { setEditingCred(cred); setShowCredForm(true) }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          disabled={credentialDeleteLoadingId === cred.id}
                          onClick={() => void openCredentialDeleteDialog(cred)}
                        >
                          <Trash2 className={credentialDeleteLoadingId === cred.id ? 'w-3.5 h-3.5 animate-pulse' : 'w-3.5 h-3.5'} />
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <Modal
        open={credentialDeleteDialog.open}
        onClose={resetCredentialDeleteDialog}
        title={credentialDeleteDialog.assetNames.length > 0 ? '无法删除凭据' : '删除凭据'}
        className="max-w-xl"
        footer={(
          <>
            <Button variant="outline" onClick={resetCredentialDeleteDialog}>取消</Button>
            {credentialDeleteDialog.assetNames.length === 0 ? (
              <Button variant="destructive" onClick={() => void handleDeleteCred()}>
                删除
              </Button>
            ) : null}
          </>
        )}
      >
        <div className="space-y-4 text-sm text-muted-foreground">
          {credentialDeleteDialog.assetNames.length > 0 ? (
            <>
              <div className="rounded-lg border border-amber-300/40 bg-amber-500/5 px-4 py-3 text-amber-700">
                凭据「{credentialDeleteDialog.credential?.name}」当前仍被以下资产绑定，暂时无法删除。请先解除绑定后再执行删除。
              </div>
              <div className="rounded-lg border border-border bg-background/60 p-4 text-left">
                <div className="mb-3 text-sm font-medium text-foreground">已绑定资产</div>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {credentialDeleteDialog.assetNames.map((assetName) => (
                    <div key={assetName} className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
                      {assetName}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div>
              确定要删除「{credentialDeleteDialog.credential?.name}」吗？
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="导出资产列表"
        className="max-w-lg"
        footer={(
          <>
            <Button variant="outline" onClick={() => setShowExportModal(false)}>取消</Button>
            <Button onClick={() => void handleExportAssets()} loading={exporting}>开始导出</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-background/60 p-3 text-sm text-muted-foreground">
            当前会基于资产列表页的筛选结果导出数据。可选择单表导出、仅导出当前环境、按环境分 sheet，或按中间件类型分 sheet。
          </div>

          <FormField label="导出方式">
            <Select value={exportMode} onValueChange={(value) => setExportMode(value as AssetExportMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">当前列表单 Sheet</SelectItem>
                <SelectItem value="selected-environment" disabled={!selectedEnvironment}>只导出当前环境</SelectItem>
                <SelectItem value="environment">按环境分 Sheet</SelectItem>
                <SelectItem value="middleware">按中间件类型分 Sheet</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              {exportMode === 'current' ? '适合快速导出当前筛选结果。' : null}
              {exportMode === 'selected-environment'
                ? selectedEnvironment
                  ? `仅导出当前选中的环境「${selectedEnvironment.name}」，适合单环境排障或交付。`
                  : '请先在列表顶部选择一个环境，再使用当前环境导出。'
                : null}
              {exportMode === 'environment' ? '每个环境单独一个 sheet，便于按环境交付。' : null}
              {exportMode === 'middleware' ? '仅导出当前筛选结果中的中间件资源，每个中间件类型一个 sheet，并拆开展示连接字段。' : null}
            </div>
          </FormField>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
            <div>
              <div className="text-sm font-medium text-foreground">包含具体凭据内容</div>
              <div className="text-xs text-muted-foreground">导出用户名与明文密码/密钥等敏感字段，仅在已解锁时允许</div>
            </div>
            <Switch
              checked={includeSensitive}
              onCheckedChange={(checked) => {
                if (checked && !canIncludeSensitive) {
                  promptUnlock('解锁后才能导出包含用户名和明文凭据的资源清单。')
                  return
                }
                setIncludeSensitive(checked)
              }}
            />
          </div>

          {includeSensitive ? (
            <div className="rounded-lg border border-amber-300/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-700">
              导出文件将包含敏感信息，请仅在可信环境下使用，并注意妥善保管。
            </div>
          ) : null}
        </div>
      </Modal>

      {/* 资产表单弹窗 */}
      <AssetFormModal
        open={showAssetForm}
        asset={editingAsset}
        environments={environments}
        credentials={credentials}
        plugins={plugins}
        onClose={() => setShowAssetForm(false)}
        onCredentialCreated={async () => { await loadCredentials() }}
        onEnvironmentCreated={async () => { await loadEnvironments() }}
        onSave={async (data) => {
          try {
            if (editingAsset) {
              await assetService.update({ id: editingAsset.id, ...data })
              toast.success('资产已更新')
            } else {
              await assetService.create(data as any)
              toast.success('资产已添加')
            }
            await loadAssets()
            setShowAssetForm(false)
          } catch (e: any) {
            toast.error('保存失败', { description: e.message })
          }
        }}
      />

      {/* 凭据表单弹窗 */}
      <CredFormModal
        open={showCredForm}
        cred={editingCred}
        onClose={() => setShowCredForm(false)}
        onSave={async (data) => {
          try {
            if (editingCred) {
              await credentialService.update({ id: editingCred.id, ...data })
              toast.success('凭据已更新')
            } else {
              await credentialService.create(data)
              toast.success('凭据已添加')
            }
            await loadCredentials()
            setShowCredForm(false)
          } catch (e: any) {
            toast.error('保存失败', { description: e.message })
          }
        }}
      />
    </div>
  )
}

// ── 资产表单弹窗 ──

function AssetFormModal({ open, asset, environments, credentials, plugins, onClose, onSave, onCredentialCreated, onEnvironmentCreated }: {
  open: boolean
  asset: Asset | null
  environments: Environment[]
  credentials: Credential[]
  plugins: PluginDef[]
  onClose: () => void
  onSave: (data: any) => Promise<void>
  onCredentialCreated?: (id: number) => void
  onEnvironmentCreated?: () => Promise<void>
}) {
  const [envId, setEnvId] = useState<string>('')
  const [groupId, setGroupId] = useState<string>('')
  const [formGroups, setFormGroups] = useState<Group[]>([])
  const [category, setCategory] = useState<AssetCategory>('server')
  const [pluginType, setPluginType] = useState<string>('linux_server')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [credId, setCredId] = useState<string>('')
  const [extConfig, setExtConfig] = useState<Record<string, unknown>>({})
  const [dnsEnabled, setDnsEnabled] = useState(true)
  const [dnsDomain, setDnsDomain] = useState('')
  const [dnsTTL, setDnsTTL] = useState(300)
  const [dnsDomainTouched, setDnsDomainTouched] = useState(false)
  const [linkedDNSRecord, setLinkedDNSRecord] = useState<DNSRecord | null>(null)
  const [dnsLoading, setDnsLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // 内联创建凭据
  const [showInlineCredForm, setShowInlineCredForm] = useState(false)
  const [inlineCredSaving, setInlineCredSaving] = useState(false)
  const [inlineCredName, setInlineCredName] = useState('')
  const [inlineCredType, setInlineCredType] = useState<CredentialType>('password')
  const [inlineCredUsername, setInlineCredUsername] = useState('')
  const [inlineCredSecret, setInlineCredSecret] = useState('')

  // 内联创建环境
  const [showInlineEnvForm, setShowInlineEnvForm] = useState(false)
  const [inlineEnvSaving, setInlineEnvSaving] = useState(false)
  const [inlineEnvName, setInlineEnvName] = useState('')
  const [inlineEnvDesc, setInlineEnvDesc] = useState('')
  const [inlineEnvColor, setInlineEnvColor] = useState('#3b82f6')

  // 内联创建分组
  const [showInlineGroupForm, setShowInlineGroupForm] = useState(false)
  const [inlineGroupSaving, setInlineGroupSaving] = useState(false)
  const [inlineGroupName, setInlineGroupName] = useState('')
  const [inlineGroupDesc, setInlineGroupDesc] = useState('')

  // 当前选中的插件定义
  const selectedPlugin = plugins.find(p => p.type_id === pluginType)
  const dnsSupported = supportsAutoDNSForPlugin(selectedPlugin)
  const selectedEnvironment = environments.find(item => item.id.toString() === envId)
  const recommendedDNSDomain = recommendAssetDNSDomain(name, pluginType, selectedEnvironment?.name)
  const compatibleCredentials = credentials.filter((credential) => {
    const supported = selectedPlugin?.credential_types ?? []
    if (!selectedPlugin || supported.length === 0) return true
    return supported.includes(credential.type) || credential.id.toString() === credId
  })

  useEffect(() => {
    if (!credId || !selectedPlugin) return
    const supported = selectedPlugin.credential_types ?? []
    if (supported.length === 0) return
    const current = credentials.find(item => item.id.toString() === credId)
    if (current && !supported.includes(current.type)) {
      setCredId('')
    }
  }, [credId, credentials, selectedPlugin])

  // 按类别过滤插件
  const categoryPlugins = plugins.filter(p => p.category === category)

  useEffect(() => {
    if (!open) return
    if (asset) {
      setEnvId(asset.environment_id?.toString() ?? '')
      setGroupId(asset.group_id?.toString() ?? '')
      setCategory(asset.category as AssetCategory)
      setPluginType(asset.plugin_type)
      setName(asset.name)
      setDescription(asset.description ?? '')
      setTagInput(asset.tags?.join(', ') ?? '')
      setCredId(asset.credential_id?.toString() ?? '')
      setExtConfig(asset.ext_config ?? {})
      setDnsEnabled(false)
      setDnsDomain(recommendAssetDNSDomain(asset.name, asset.plugin_type, environments.find(item => item.id === asset.environment_id)?.name))
      setDnsTTL(300)
      setDnsDomainTouched(false)
      setLinkedDNSRecord(null)
    } else {
      setEnvId(environments[0]?.id?.toString() ?? '')
      setGroupId('')
      setCategory('server')
      setPluginType('linux_server')
      setName('')
      setDescription('')
      setTagInput('')
      setCredId('')
      setExtConfig(buildDefaultConfig(plugins, 'linux_server'))
      setDnsEnabled(true)
      setDnsTTL(300)
      setDnsDomainTouched(false)
      setDnsDomain(recommendAssetDNSDomain('', 'linux_server', environments[0]?.name))
      setLinkedDNSRecord(null)
    }
  }, [open, asset, environments, plugins])

  // 切换环境时加载分组
  useEffect(() => {
    if (!envId) {
      setFormGroups([])
      return
    }
    groupService.listByEnvironment(Number(envId))
      .then((list) => setFormGroups(list as Group[]))
      .catch(() => setFormGroups([]))
  }, [envId])

  useEffect(() => {
  if (!open || !asset) return
  let cancelled = false
  setDnsLoading(true)
  dnsService.getByAssetId(asset.id)
    .then((record) => {
      if (cancelled) return
      setLinkedDNSRecord(record)
      if (record) {
        setDnsEnabled(record.enabled)
        setDnsDomain(record.domain)
        setDnsTTL(record.ttl)
        setDnsDomainTouched(false)
      } else {
        setDnsEnabled(dnsSupported)
        setDnsDomain(recommendAssetDNSDomain(asset.name, asset.plugin_type, selectedEnvironment?.name))
        setDnsTTL(300)
        setDnsDomainTouched(false)
      }
    })
    .catch((error: any) => {
      if (cancelled) return
      toast.error('加载资产关联 DNS 失败', { description: error.message })
    })
    .finally(() => {
      if (!cancelled) setDnsLoading(false)
    })
  return () => {
    cancelled = true
  }
  }, [open, asset, dnsSupported, selectedEnvironment?.name])

  useEffect(() => {
    if (!open || asset) return
    if (!dnsSupported) {
      setDnsEnabled(false)
      return
    }
    if (!dnsDomainTouched) {
      setDnsDomain(recommendedDNSDomain)
    }
  }, [open, asset, dnsSupported, dnsDomainTouched, recommendedDNSDomain])

  // 切换类别时重置插件类型和 extConfig
  const handleCategoryChange = (cat: AssetCategory) => {
    setCategory(cat)
    const firstPlugin = plugins.find(p => p.category === cat)
    if (firstPlugin) {
      setPluginType(firstPlugin.type_id)
      setExtConfig(buildDefaultConfig(plugins, firstPlugin.type_id))
      setDnsDomainTouched(false)
    }
  }

  // 切换插件类型时重置 extConfig 的默认值（保留已填内容）
  const handlePluginChange = (typeId: string) => {
    setPluginType(typeId)
    setDnsDomainTouched(false)
    setExtConfig(prev => {
      const defaults = buildDefaultConfig(plugins, typeId)
      // 对于新插件，用默认值初始化；已有值保留
      return { ...defaults, ...prev }
    })
  }

  const handleInlineEnvSubmit = async () => {
    if (!inlineEnvName.trim()) { toast.warning('环境名称不能为空'); return }
    setInlineEnvSaving(true)
    try {
      const created = await environmentService.create({ name: inlineEnvName.trim(), description: inlineEnvDesc, color: inlineEnvColor })
      toast.success(`环境「${created.name}」已创建`)
      setShowInlineEnvForm(false)
      await onEnvironmentCreated?.()
      setEnvId(created.id.toString())
    } catch (error: any) {
      toast.error('创建环境失败', { description: error.message })
    } finally {
      setInlineEnvSaving(false)
    }
  }

  const handleInlineGroupSubmit = async () => {
    if (!inlineGroupName.trim()) { toast.warning('分组名称不能为空'); return }
    if (!envId) { toast.warning('请先选择环境'); return }
    setInlineGroupSaving(true)
    try {
      const created = await groupService.create({ environment_id: Number(envId), name: inlineGroupName.trim(), description: inlineGroupDesc })
      toast.success(`分组「${created.name}」已创建`)
      setShowInlineGroupForm(false)
      setFormGroups(await groupService.listByEnvironment(Number(envId)) as Group[])
      setGroupId(created.id.toString())
    } catch (error: any) {
      toast.error('创建分组失败', { description: error.message })
    } finally {
      setInlineGroupSaving(false)
    }
  }

  const openInlineCredForm = () => {
    const supportedTypes = selectedPlugin?.credential_types ?? []
    setInlineCredName('')
    setInlineCredType(supportedTypes.length > 0 ? supportedTypes[0] : 'password')
    setInlineCredUsername('')
    setInlineCredSecret('')
    setShowInlineCredForm(true)
  }

  const handleInlineCredSubmit = async () => {
    if (!inlineCredName.trim()) { toast.warning('凭据名称不能为空'); return }
    if (!inlineCredSecret) { toast.warning('密钥/密码不能为空'); return }
    setInlineCredSaving(true)
    try {
      const created = await credentialService.create({
        name: inlineCredName.trim(),
        type: inlineCredType,
        username: inlineCredUsername,
        secret: inlineCredSecret,
      })
      toast.success(`凭据「${created.name}」已创建`)
      setShowInlineCredForm(false)
      onCredentialCreated?.(created.id)
      setCredId(created.id.toString())
    } catch (error: any) {
      toast.error('创建凭据失败', { description: error.message })
    } finally {
      setInlineCredSaving(false)
    }
  }

  const inlineCredNeedsIdentity = inlineCredType === 'password' || inlineCredType === 'access_key_secret' || inlineCredType === 'sasl'
  const inlineCredSecretLabel = (() => {
    switch (inlineCredType) {
      case 'ssh_key': return 'SSH 私钥'
      case 'token': return 'Token / 密钥'
      case 'access_key_secret': return 'SecretKey'
      case 'sasl': return 'SASL 密钥'
      default: return '密码'
    }
  })()
  const inlineCredSupportedTypes = selectedPlugin?.credential_types ?? []

  const handleAssetSubmit = async () => {
    if (!name.trim()) { toast.warning('资产名称不能为空'); return }
    if (!envId) { toast.warning('请选择环境'); return }
    if (!pluginType) { toast.warning('请选择资产类型'); return }
    setSaving(true)
    try {
      const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
      await onSave({
        environment_id: Number(envId),
        group_id: groupId ? Number(groupId) : undefined,
        category,
        plugin_type: pluginType,
        name: name.trim(),
        description: description.trim(),
        tags,
        credential_id: credId ? Number(credId) : undefined,
        ext_config: extConfig,
        dns_config: {
          enabled: dnsSupported ? dnsEnabled : false,
          domain: dnsSupported && dnsEnabled ? dnsDomain.trim() : '',
          ttl: dnsTTL,
        },
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={asset ? '编辑资产' : '添加资产'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleAssetSubmit} loading={saving}>保存</Button>
        </>
      }
    >
      <div className="space-y-3">
        {/* 环境 + 类别 */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="环境" required>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select value={envId || '__none__'} onValueChange={v => { setEnvId(v === '__none__' ? '' : v); setGroupId('') }}>
                  <SelectTrigger><SelectValue placeholder="选择环境" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">请选择环境</SelectItem>
                    {environments.map(e => (
                      <SelectItem key={e.id} value={e.id.toString()}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
                          {e.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setInlineEnvName(''); setInlineEnvDesc(''); setInlineEnvColor('#3b82f6'); setShowInlineEnvForm(true) }} className="shrink-0">
                <Plus className="h-3.5 w-3.5" />
                新建
              </Button>
            </div>
          </FormField>
          <FormField label="类别" required>
            <Select
              value={category}
              onValueChange={v => handleCategoryChange(v as AssetCategory)}
              disabled={!!asset}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(CATEGORY_LABELS) as [AssetCategory, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        {/* 插件类型 */}
        <FormField label="资产类型" required>
          <Select
            value={pluginType}
            onValueChange={handlePluginChange}
            disabled={!!asset}
          >
            <SelectTrigger><SelectValue placeholder="选择类型" /></SelectTrigger>
            <SelectContent>
              {categoryPlugins.map(p => (
                <SelectItem key={p.type_id} value={p.type_id}>{p.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {/* 分组（可选） */}
        {envId && (
          <FormField label="分组">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select value={groupId || '__none__'} onValueChange={v => setGroupId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="不分组" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">不分组</SelectItem>
                    {formGroups.map(g => (
                      <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setInlineGroupName(''); setInlineGroupDesc(''); setShowInlineGroupForm(true) }} className="shrink-0">
                <Plus className="h-3.5 w-3.5" />
                新建
              </Button>
            </div>
          </FormField>
        )}

        {/* 资产名称 */}
        <FormField label="名称" required>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="资产显示名称"
          />
        </FormField>

        {/* 动态配置字段分隔线 */}
        {selectedPlugin && selectedPlugin.config_schema.length > 0 && (
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">
                {selectedPlugin.display_name} 连接配置
              </span>
            </div>
          </div>
        )}

        {/* 动态表单 */}
        {selectedPlugin && (
          <DynamicConfigForm
            schema={selectedPlugin.config_schema}
            value={extConfig}
            onChange={setExtConfig}
          />
        )}

        {/* 凭据 + 标签 + 备注 */}
        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">基础信息</span>
          </div>
        </div>

        <FormField label="凭据">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select
                value={credId || '__none__'}
                onValueChange={v => setCredId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="不绑定凭据" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不绑定凭据</SelectItem>
                  {compatibleCredentials.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      <span className="flex items-center gap-2">
                        <KeyRound className="w-3 h-3" />
                        {c.name} · {CREDENTIAL_TYPE_LABELS[c.type]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={openInlineCredForm} className="shrink-0">
              <Plus className="h-3.5 w-3.5" />
              新建
            </Button>
          </div>
          {selectedPlugin && (
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedPlugin.credential_required ? '当前插件要求绑定凭据。' : '当前插件可选绑定凭据。'}
              {selectedPlugin.credential_types && selectedPlugin.credential_types.length > 0
                ? ` 支持类型：${selectedPlugin.credential_types.map(type => CREDENTIAL_TYPE_LABELS[type]).join('、')}`
                : ' 支持任意凭据类型。'}
            </p>
          )}
        </FormField>

        <FormField label="标签（逗号分隔）">
          <Input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            placeholder="web, nginx, proxy"
          />
        </FormField>

        <FormField label="备注">
          <Input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="可选"
          />
        </FormField>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">DNS 联动</span>
              </div>
            </div>

            <>
              {asset && (
                <p className="text-xs text-muted-foreground">
                  编辑资产时会同步维护关联 A 记录。关闭开关将删除当前资产绑定的 DNS 记录。
                </p>
              )}

                <FormField label="自动创建 DNS 解析">
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                    <div>
                      <p className="text-sm text-foreground">{asset ? '维护关联 DNS 记录' : '创建资产时同步添加 DNS 记录'}</p>
                      <p className="text-xs text-muted-foreground">
                        {dnsSupported
                          ? '将创建 A 记录，并自动绑定当前资产的 host 地址。'
                          : '当前资产类型没有 host 字段，暂不支持自动生成关联 DNS。'}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={dnsSupported && dnsEnabled}
                      disabled={!dnsSupported}
                      onClick={() => dnsSupported && setDnsEnabled(prev => !prev)}
                      className={[
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none',
                        !dnsSupported ? 'cursor-not-allowed opacity-50 bg-input' : (dnsEnabled ? 'bg-primary' : 'bg-input'),
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg transition-transform',
                          dnsSupported && dnsEnabled ? 'translate-x-4' : 'translate-x-0.5',
                        ].join(' ')}
                      />
                    </button>
                  </div>
                </FormField>

                {dnsSupported && dnsEnabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="推荐域名" required className="col-span-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={dnsDomain}
                          onChange={e => {
                            setDnsDomain(e.target.value)
                            setDnsDomainTouched(true)
                          }}
                          placeholder="例如 web-01.linux-server.dev.local"
                        />
                        <CopyButton
                          text={dnsDomain}
                          label="推荐域名"
                          disabled={dnsDomain.trim().length === 0}
                          className="h-9 w-9 text-muted-foreground"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        默认根据环境名、资产类型和资产名称生成，可手动调整。
                      </p>
                    </FormField>

                    <FormField label="TTL（秒）" required>
                      <Input
                        type="number"
                        min={30}
                        max={86400}
                        value={dnsTTL}
                        onChange={e => setDnsTTL(Number(e.target.value) || 300)}
                      />
                    </FormField>

                    <FormField label="解析目标">
                      <div className="flex items-center gap-2">
                        <Input
                          value={String(extConfig.host ?? '')}
                          disabled
                          placeholder="请先填写 host"
                          className="font-mono"
                        />
                        <CopyButton
                          text={String(extConfig.host ?? '')}
                          label="解析目标"
                          disabled={String(extConfig.host ?? '').trim().length === 0}
                          className="h-9 w-9 text-muted-foreground"
                        />
                      </div>
                    </FormField>

                    {asset && (
                      <div className="col-span-2 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                        {dnsLoading
                          ? '正在读取当前关联 DNS...'
                          : linkedDNSRecord
                            ? `当前已绑定域名：${linkedDNSRecord.domain}，TTL ${linkedDNSRecord.ttl}s`
                            : '当前资产尚未绑定 DNS 记录，保存后会按当前配置创建。'}
                      </div>
                    )}
                  </div>
                )}
            </>

      </div>
    </Modal>

    {/* 内联创建凭据弹窗 */}
    <Modal
      open={showInlineCredForm}
      onClose={() => setShowInlineCredForm(false)}
      title="新建凭据"
      footer={
        <>
          <Button variant="outline" onClick={() => setShowInlineCredForm(false)}>取消</Button>
          <Button onClick={handleInlineCredSubmit} loading={inlineCredSaving}>创建</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="凭据名称" required>
          <Input
            value={inlineCredName}
            onChange={e => setInlineCredName(e.target.value)}
            placeholder="例如：生产服务器 root"
          />
        </FormField>
        <FormField label="类型" required>
          <Select value={inlineCredType} onValueChange={v => setInlineCredType(v as CredentialType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(inlineCredSupportedTypes.length > 0
                ? [
                    { value: 'password', label: '用户名 + 密码' },
                    { value: 'ssh_key', label: 'SSH 私钥' },
                    { value: 'token', label: 'Token / 访问密钥' },
                    { value: 'access_key_secret', label: 'AccessKey + SecretKey' },
                    { value: 'sasl', label: 'SASL 用户名 + 密钥' },
                  ].filter(item => inlineCredSupportedTypes.includes(item.value as CredentialType))
                : [
                    { value: 'password', label: '用户名 + 密码' },
                    { value: 'ssh_key', label: 'SSH 私钥' },
                    { value: 'token', label: 'Token / 访问密钥' },
                    { value: 'access_key_secret', label: 'AccessKey + SecretKey' },
                    { value: 'sasl', label: 'SASL 用户名 + 密钥' },
                  ]
              ).map(item => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        {inlineCredNeedsIdentity && (
          <FormField label="用户名">
            <Input
              value={inlineCredUsername}
              onChange={e => setInlineCredUsername(e.target.value)}
              placeholder={inlineCredType === 'access_key_secret' ? 'AccessKey' : inlineCredType === 'sasl' ? 'SASL 用户名' : 'root / admin'}
            />
          </FormField>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            {inlineCredSecretLabel}
            <span className="text-destructive ml-0.5">*</span>
          </Label>
          <Textarea
            value={inlineCredSecret}
            onChange={e => setInlineCredSecret(e.target.value)}
            placeholder={
              inlineCredType === 'ssh_key'
                ? '-----BEGIN RSA PRIVATE KEY-----\n...'
                : inlineCredType === 'token'
                  ? 'token-xxxx'
                  : inlineCredType === 'access_key_secret'
                    ? 'SecretKey'
                    : inlineCredType === 'sasl'
                      ? 'SASL password or secret'
                      : '••••••••'
            }
            rows={inlineCredType === 'ssh_key' ? 5 : 1}
            className="font-mono"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          密钥使用 AES-256-GCM 加密存储，展示时自动脱敏
        </p>
      </div>
    </Modal>

    {/* 内联创建环境弹窗 */}
    <Modal
      open={showInlineEnvForm}
      onClose={() => setShowInlineEnvForm(false)}
      title="新建环境"
      className="max-w-sm"
      footer={
        <>
          <Button variant="outline" onClick={() => setShowInlineEnvForm(false)}>取消</Button>
          <Button onClick={handleInlineEnvSubmit} loading={inlineEnvSaving}>创建</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="环境名称" required>
          <Input value={inlineEnvName} onChange={e => setInlineEnvName(e.target.value)} placeholder="例如：生产环境" />
        </FormField>
        <FormField label="描述">
          <Input value={inlineEnvDesc} onChange={e => setInlineEnvDesc(e.target.value)} placeholder="可选" />
        </FormField>
        <FormField label="标识颜色">
          <div className="flex gap-2 flex-wrap pt-0.5">
            {['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'].map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setInlineEnvColor(c)}
                className="w-6 h-6 rounded-full transition-transform focus-visible:outline-none"
                style={{
                  backgroundColor: c,
                  transform: inlineEnvColor === c ? 'scale(1.3)' : 'scale(1)',
                  boxShadow: inlineEnvColor === c ? `0 0 0 2px var(--color-background), 0 0 0 4px ${c}` : 'none',
                }}
              />
            ))}
          </div>
        </FormField>
      </div>
    </Modal>

    {/* 内联创建分组弹窗 */}
    <Modal
      open={showInlineGroupForm}
      onClose={() => setShowInlineGroupForm(false)}
      title="新建分组"
      className="max-w-sm"
      footer={
        <>
          <Button variant="outline" onClick={() => setShowInlineGroupForm(false)}>取消</Button>
          <Button onClick={handleInlineGroupSubmit} loading={inlineGroupSaving}>创建</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="分组名称" required>
          <Input value={inlineGroupName} onChange={e => setInlineGroupName(e.target.value)} placeholder="例如：Web 层" />
        </FormField>
        <FormField label="描述">
          <Input value={inlineGroupDesc} onChange={e => setInlineGroupDesc(e.target.value)} placeholder="可选" />
        </FormField>
      </div>
    </Modal>
    </>
  )
}

function CredFormModal({ open, cred, onClose, onSave }: {
  open: boolean
  cred: Credential | null
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<CredentialType>('password')
  const [username, setUsername] = useState('')
  const [secret, setSecret] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(cred?.name ?? '')
      setType((cred?.type as CredentialType) ?? 'password')
      setUsername(cred?.username ?? '')
      setSecret('')
    }
  }, [open, cred])

  const handleSubmit = async () => {
    if (!name.trim()) { toast.warning('凭据名称不能为空'); return }
    if (!cred && !secret) { toast.warning('密钥/密码不能为空'); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), type, username, secret })
    } finally {
      setSaving(false)
    }
  }

  const needsIdentity = type === 'password' || type === 'access_key_secret' || type === 'sasl'
  const secretLabelBase = (() => {
    switch (type) {
      case 'ssh_key':
        return 'SSH 私钥'
      case 'token':
        return 'Token / 密钥'
      case 'access_key_secret':
        return 'SecretKey'
      case 'sasl':
        return 'SASL 密钥'
      default:
        return '密码'
    }
  })()

  const secretLabel = cred ? `${secretLabelBase}（留空则不修改）` : secretLabelBase

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cred ? '编辑凭据' : '添加凭据'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} loading={saving}>保存</Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="凭据名称" required>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例如：生产服务器 root"
          />
        </FormField>
        <FormField label="类型" required>
          <Select value={type} onValueChange={v => setType(v as CredentialType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="password">用户名 + 密码</SelectItem>
              <SelectItem value="ssh_key">SSH 私钥</SelectItem>
              <SelectItem value="token">Token / 访问密钥</SelectItem>
              <SelectItem value="access_key_secret">AccessKey + SecretKey</SelectItem>
              <SelectItem value="sasl">SASL 用户名 + 密钥</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        {needsIdentity && (
          <FormField label="用户名">
            <Input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={type === 'access_key_secret' ? 'AccessKey' : type === 'sasl' ? 'SASL 用户名' : 'root / admin'}
            />
          </FormField>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            {secretLabel}
            {!cred && <span className="text-destructive ml-0.5">*</span>}
          </Label>
          <Textarea
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder={
              type === 'ssh_key'
                ? '-----BEGIN RSA PRIVATE KEY-----\n...'
                : type === 'token'
                  ? 'token-xxxx'
                  : type === 'access_key_secret'
                    ? 'SecretKey'
                    : type === 'sasl'
                      ? 'SASL password or secret'
                      : '••••••••'
            }
            rows={type === 'ssh_key' ? 5 : 1}
            className="font-mono"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          密钥使用 AES-256-GCM 加密存储，展示时自动脱敏
        </p>
      </div>
    </Modal>
  )
}

// ── 工具函数 ──

function buildDefaultConfig(plugins: PluginDef[], typeId: string): Record<string, unknown> {
  const def = plugins.find(p => p.type_id === typeId)
  if (!def) return {}
  const result: Record<string, unknown> = {}
  for (const field of def.config_schema) {
    if (field.default_val !== undefined) {
      result[field.key] = field.default_val
    }
  }
  return result
}

function supportsAutoDNSForPlugin(plugin?: PluginDef): boolean {
  return Boolean(plugin?.config_schema?.some(field => field.key === 'host'))
}

function recommendAssetDNSDomain(assetName: string, pluginType: string, environmentName?: string): string {
  const assetPart = slugDomainLabel(assetName) || 'asset'
  const pluginPart = slugDomainLabel(pluginType) || 'service'
  const envPart = slugDomainLabel(environmentName || '') || 'env'
  return `${assetPart}.${pluginPart}.${envPart}.local`
}

function slugDomainLabel(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// AssetPage.tsx — 资产列表页面
import { useEffect, useState } from 'react'
import {
  Plus, Search, Server, Database, Zap, Send, Box,
  Trash2, Pencil, KeyRound, RefreshCw, type LucideProps,
} from 'lucide-react'
import { toast } from 'sonner'
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
import { Modal, FormField } from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { assetService, credentialService } from '@/services/assetService'
import { dnsService } from '@/services/dnsService'
import { healthService } from '@/services/healthService'
import type {
  Asset, Credential, AssetCategory, CredentialType, PluginDef, Environment,
} from '@/types/asset'
import type { DNSRecord } from '@/types/dns'
import type { HealthSnapshot } from '@/types/health'
import {
  CATEGORY_LABELS, CATEGORY_COLORS, ASSET_STATUS_LABELS, ASSET_STATUS_COLORS,
  CREDENTIAL_TYPE_LABELS,
  getAssetAddress,
} from '@/types/asset'

// ── 图标映射 ──

const CATEGORY_ICONS: Record<AssetCategory, React.FC<LucideProps>> = {
  server: Server,
  database: Database,
  cache: Zap,
  mq: Send,
  other: Box,
}

type TabType = 'assets' | 'credentials'

// ── 主页面 ──

export default function AssetPage() {
  const {
    environments, assets, credentials, plugins,
    selectedEnvId, loading,
    loadEnvironments, loadAssets, loadCredentials, loadPlugins,
    setSelectedEnv,
  } = useAssetStore()

  const handleRefresh = async () => {
    if (tab === 'assets') {
      await Promise.all([loadEnvironments(), loadAssets(), loadCredentials(), loadPlugins()])
    } else {
      await loadCredentials()
    }
  }

  const [tab, setTab] = useState<TabType>('assets')
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | ''>('')
  const [pluginFilter, setPluginFilter] = useState('')

  const [showAssetForm, setShowAssetForm] = useState(false)
  const [showCredForm, setShowCredForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [editingCred, setEditingCred] = useState<Credential | null>(null)
  const [healthByAssetId, setHealthByAssetId] = useState<Record<number, HealthSnapshot>>({})

  useEffect(() => {
    loadEnvironments()
    loadAssets()
    loadCredentials()
    loadPlugins()
  }, [])

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
          keyword: keyword || undefined,
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
  }, [tab, assets, selectedEnvId, categoryFilter, keyword])

  const handleSearch = () => loadAssets({
    environment_id: selectedEnvId ?? undefined,
    category: categoryFilter || undefined,
    plugin_type: pluginFilter || undefined,
    keyword: keyword || undefined,
  })

  const handleDeleteAsset = async (id: number, name: string) => {
    try {
      await assetService.delete(id)
      toast.success(`资产「${name}」已删除`)
      await loadAssets()
    } catch (e: any) {
      toast.error('删除失败', { description: e.message })
    }
  }

  const handleDeleteCred = async (id: number, name: string) => {
    try {
      await credentialService.delete(id)
      toast.success(`凭据「${name}」已删除`)
      await loadCredentials()
    } catch (e: any) {
      toast.error('删除失败', { description: e.message })
    }
  }

  // 按 category 过滤可用插件
  const filteredPlugins = categoryFilter
    ? plugins.filter(p => p.category === categoryFilter)
    : plugins

  return (
    <div className="space-y-5 animate-in fade-in-0 duration-200">
      {/* 顶部 Tab + 操作按钮 */}
      <div className="flex items-center justify-between">
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
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* 资产列表 Tab */}
      {tab === 'assets' && (
        <>
          {/* 筛选栏 */}
          <div className="flex gap-2">
            <Select
              value={selectedEnvId?.toString() ?? '__all__'}
              onValueChange={v => setSelectedEnv(v === '__all__' ? null : Number(v))}
            >
              <SelectTrigger className="w-40">
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

            <Select
              value={categoryFilter || '__all__'}
              onValueChange={v => {
                setCategoryFilter(v === '__all__' ? '' : v as AssetCategory)
                setPluginFilter('')
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="全部类别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部类别</SelectItem>
                {(Object.keys(CATEGORY_LABELS) as AssetCategory[]).map(k => (
                  <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={pluginFilter || '__all__'}
              onValueChange={v => setPluginFilter(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部类型</SelectItem>
                {filteredPlugins.map(p => (
                  <SelectItem key={p.type_id} value={p.type_id}>{p.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1 flex items-center gap-2 px-3 rounded-md border bg-card border-border">
              <Search className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="搜索资产名称..."
                className="flex-1 py-2 text-sm outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Button variant="secondary" onClick={handleSearch}>搜索</Button>
          </div>

          {/* 资产表格 */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary border-b border-border">
                  {['资产名称', '类型', '连接地址', '环境', '状态', '健康', '操作'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-sm text-muted-foreground">
                      暂无资产，点击「添加资产」开始
                    </td>
                  </tr>
                ) : assets.map(asset => {
                  const cat = asset.category as AssetCategory
                  const Icon = CATEGORY_ICONS[cat] ?? Box
                  const color = CATEGORY_COLORS[cat] ?? '#6b7280'
                  const plugin = plugins.find(p => p.type_id === asset.plugin_type)
                  return (
                    <tr key={asset.id} className="border-t border-border bg-card hover:bg-accent/30 transition-colors">
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
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {getAssetAddress(asset)}
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
                      <td className="px-4 py-3">
                        <StatusBadge status={asset.status as any} />
                      </td>
                      <td className="px-4 py-3 max-w-[320px]">
                        <HealthMetricBadges snapshot={healthByAssetId[asset.id]} emptyText="未检查" />
                      </td>
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
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary border-b border-border">
                {['名称', '类型', '用户名', '密钥', '操作'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {credentials.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-sm text-muted-foreground">
                    暂无凭据，点击「添加凭据」开始
                  </td>
                </tr>
              ) : credentials.map(cred => (
                <tr key={cred.id} className="border-t border-border bg-card hover:bg-accent/30 transition-colors">
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon"
                        onClick={() => { setEditingCred(cred); setShowCredForm(true) }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <ConfirmDialog
                        title="删除凭据"
                        description={`确定要删除「${cred.name}」吗？关联资产将失去连接凭据。`}
                        confirmText="删除" danger
                        onConfirm={() => handleDeleteCred(cred.id, cred.name)}
                      >
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </ConfirmDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 资产表单弹窗 */}
      <AssetFormModal
        open={showAssetForm}
        asset={editingAsset}
        environments={environments}
        credentials={credentials}
        plugins={plugins}
        onClose={() => setShowAssetForm(false)}
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

function AssetFormModal({ open, asset, environments, credentials, plugins, onClose, onSave }: {
  open: boolean
  asset: Asset | null
  environments: Environment[]
  credentials: Credential[]
  plugins: PluginDef[]
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [envId, setEnvId] = useState<string>('')
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

  const handleSubmit = async () => {
    if (!name.trim()) { toast.warning('资产名称不能为空'); return }
    if (!envId) { toast.warning('请选择环境'); return }
    if (!pluginType) { toast.warning('请选择资产类型'); return }
    setSaving(true)
    try {
      const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
      await onSave({
        environment_id: Number(envId),
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
    <Modal
      open={open}
      onClose={onClose}
      title={asset ? '编辑资产' : '添加资产'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} loading={saving}>保存</Button>
        </>
      }
    >
      <div className="space-y-3">
        {/* 环境 + 类别 */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="环境" required>
            <Select value={envId || '__none__'} onValueChange={v => setEnvId(v === '__none__' ? '' : v)}>
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
                      <Input
                        value={dnsDomain}
                        onChange={e => {
                          setDnsDomain(e.target.value)
                          setDnsDomainTouched(true)
                        }}
                        placeholder="例如 web-01.linux-server.dev.local"
                      />
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
                      <Input
                        value={String(extConfig.host ?? '')}
                        disabled
                        placeholder="请先填写 host"
                      />
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
  )
}

// ── 凭据表单弹窗 ──

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

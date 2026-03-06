// AssetPage.tsx — 资产列表页面（shadcn 风格 + Sonner toast）
import { useEffect, useState } from 'react'
import { Plus, Search, Server, Database, Wifi, Trash2, Pencil, KeyRound, type LucideProps } from 'lucide-react'
import { toast } from 'sonner'
import { useAssetStore } from '@/store/assetStore'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Modal, FormField } from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { assetService, credentialService } from '@/services/assetService'
import type { Asset, Credential } from '@/services/assetService'
import type { AssetType, CredentialType } from '@/types/asset'
import { ASSET_TYPE_LABELS, ASSET_DEFAULT_PORTS } from '@/types/asset'

const ASSET_ICONS: Record<AssetType, React.FC<LucideProps>> = {
  server: Server, mysql: Database, redis: Database, rocketmq: Wifi, rabbitmq: Wifi,
}
const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  server: '#60a5fa', mysql: '#f97316', redis: '#ef4444', rocketmq: '#8b5cf6', rabbitmq: '#f59e0b',
}

type TabType = 'assets' | 'credentials'

export default function AssetPage() {
  const { environments, assets, credentials, selectedEnvId, loadEnvironments, loadAssets, loadCredentials, setSelectedEnv } = useAssetStore()
  const [tab, setTab] = useState<TabType>('assets')
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState<AssetType | ''>('')
  const [showAssetForm, setShowAssetForm] = useState(false)
  const [showCredForm, setShowCredForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [editingCred, setEditingCred] = useState<Credential | null>(null)

  useEffect(() => { loadEnvironments(); loadAssets(); loadCredentials() }, [])

  const handleSearch = () => loadAssets({
    environment_id: selectedEnvId ?? undefined,
    type: typeFilter || undefined,
    keyword: keyword || undefined,
  })

  const handleDeleteAsset = async (id: number, name: string) => {
    try {
      await assetService.delete(id)
      toast.success(`资产「${name}」已删除`)
      await loadAssets()
    } catch (e: any) { toast.error('删除失败', { description: e.message }) }
  }

  const handleDeleteCred = async (id: number, name: string) => {
    try {
      await credentialService.delete(id)
      toast.success(`凭据「${name}」已删除`)
      await loadCredentials()
    } catch (e: any) { toast.error('删除失败', { description: e.message }) }
  }

  return (
    <div className="space-y-5 animate-in fade-in-0 duration-200">
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
        <Button onClick={() => tab === 'assets'
          ? (setEditingAsset(null), setShowAssetForm(true))
          : (setEditingCred(null), setShowCredForm(true))
        }>
          <Plus className="w-4 h-4" />
          {tab === 'assets' ? '添加资产' : '添加凭据'}
        </Button>
      </div>

      {tab === 'assets' && (
        <>
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
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
                      {e.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={typeFilter || '__all__'}
              onValueChange={v => setTypeFilter(v === '__all__' ? '' : v as AssetType)}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">全部类型</SelectItem>
                {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1 flex items-center gap-2 px-3 rounded-md border bg-card border-border">
              <Search className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="搜索名称或 Host..."
                className="flex-1 py-2 text-sm outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Button variant="secondary" onClick={handleSearch}>搜索</Button>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary border-b border-border">
                  {['资产名称', '类型', 'Host / 端口', '环境', '状态', '操作'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-foreground">
                      暂无资产，点击「添加资产」开始
                    </td>
                  </tr>
                ) : assets.map(asset => {
                  const t = asset.type as AssetType
                  const Icon = ASSET_ICONS[t]
                  const color = ASSET_TYPE_COLORS[t]
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
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: color + '20', color }}>
                          {ASSET_TYPE_LABELS[t]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-foreground">{asset.host}</div>
                        <div className="font-mono text-xs text-muted-foreground">:{asset.port}</div>
                      </td>
                      <td className="px-4 py-3">
                        {asset.environment && (
                          <span className="flex items-center gap-1.5 text-xs">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: asset.environment.color }} />
                            <span className="text-muted-foreground">{asset.environment.name}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={asset.status as any} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon"
                            onClick={() => { setEditingAsset(asset); setShowAssetForm(true) }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <ConfirmDialog title="删除资产"
                            description={`确定要删除资产「${asset.name}」吗？`}
                            confirmText="删除" danger onConfirm={() => handleDeleteAsset(asset.id, asset.name)}>
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
                      {cred.type === 'password' ? '密码' : cred.type === 'ssh_key' ? 'SSH 密钥' : 'Token'}
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
                      <ConfirmDialog title="删除凭据"
                        description={`确定要删除「${cred.name}」吗？关联资产将失去连接凭据。`}
                        confirmText="删除" danger onConfirm={() => handleDeleteCred(cred.id, cred.name)}>
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

      <AssetFormModal
        open={showAssetForm}
        asset={editingAsset}
        environments={environments}
        credentials={credentials}
        onClose={() => setShowAssetForm(false)}
        onSave={async (data) => {
          try {
            if (editingAsset) {
              await assetService.update({ id: editingAsset.id, ...data } as any)
              toast.success('资产已更新')
            } else {
              await assetService.create(data as any)
              toast.success('资产已添加')
            }
            await loadAssets()
            setShowAssetForm(false)
          } catch (e: any) { toast.error('保存失败', { description: e.message }) }
        }}
      />

      <CredFormModal
        open={showCredForm}
        cred={editingCred}
        onClose={() => setShowCredForm(false)}
        onSave={async (data) => {
          try {
            if (editingCred) {
              await credentialService.update({ id: editingCred.id, ...data } as any)
              toast.success('凭据已更新')
            } else {
              await credentialService.create(data as any)
              toast.success('凭据已添加')
            }
            await loadCredentials()
            setShowCredForm(false)
          } catch (e: any) { toast.error('保存失败', { description: e.message }) }
        }}
      />
    </div>
  )
}

function AssetFormModal({ open, asset, environments, credentials, onClose, onSave }: {
  open: boolean
  asset: Asset | null
  environments: any[]
  credentials: Credential[]
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [envId, setEnvId] = useState<string>(asset?.environment_id?.toString() ?? '')
  const [type, setType] = useState<AssetType>((asset?.type as AssetType) ?? 'server')
  const [name, setName] = useState(asset?.name ?? '')
  const [host, setHost] = useState(asset?.host ?? '')
  const [port, setPort] = useState<string>(asset?.port?.toString() ?? '')
  const [description, setDescription] = useState(asset?.description ?? '')
  const [tagInput, setTagInput] = useState(asset?.tags?.join(', ') ?? '')
  const [credId, setCredId] = useState<string>(asset?.credential_id?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setEnvId(asset?.environment_id?.toString() ?? (environments[0]?.id?.toString() ?? ''))
      setType((asset?.type as AssetType) ?? 'server')
      setName(asset?.name ?? '')
      setHost(asset?.host ?? '')
      setPort(asset?.port?.toString() ?? ASSET_DEFAULT_PORTS['server'].toString())
      setDescription(asset?.description ?? '')
      setTagInput(asset?.tags?.join(', ') ?? '')
      setCredId(asset?.credential_id?.toString() ?? '')
    }
  }, [open, asset])

  const handleTypeChange = (t: AssetType) => {
    setType(t)
    if (!asset) setPort(ASSET_DEFAULT_PORTS[t].toString())
  }

  const handleSubmit = async () => {
    if (!name.trim()) { toast.warning('资产名称不能为空'); return }
    if (!host.trim()) { toast.warning('Host 不能为空'); return }
    if (!envId) { toast.warning('请选择环境'); return }
    setSaving(true)
    try {
      const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
      await onSave({
        environment_id: Number(envId), type, name: name.trim(), host: host.trim(),
        port: Number(port), description, tags,
        credential_id: credId ? Number(credId) : undefined,
      })
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={asset ? '编辑资产' : '添加资产'}>
      <div className="space-y-3">
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
          <FormField label="类型" required>
            <Select value={type} onValueChange={v => handleTypeChange(v as AssetType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField label="名称" required>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="资产显示名称" />
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <FormField label="Host" required>
              <Input value={host} onChange={e => setHost(e.target.value)} placeholder="IP 或域名" className="font-mono" />
            </FormField>
          </div>
          <FormField label="端口">
            <Input type="number" value={port} onChange={e => setPort(e.target.value)} className="font-mono" />
          </FormField>
        </div>
        <FormField label="凭据">
          <Select value={credId || '__none__'} onValueChange={v => setCredId(v === '__none__' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="不绑定凭据" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">不绑定凭据</SelectItem>
              {credentials.map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="标签（逗号分隔）">
          <Input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="web, nginx, proxy" />
        </FormField>
        <FormField label="描述">
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="可选" />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} loading={saving}>保存</Button>
        </div>
      </div>
    </Modal>
  )
}

function CredFormModal({ open, cred, onClose, onSave }: {
  open: boolean
  cred: Credential | null
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [name, setName] = useState(cred?.name ?? '')
  const [type, setType] = useState<CredentialType>((cred?.type as CredentialType) ?? 'password')
  const [username, setUsername] = useState(cred?.username ?? '')
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
    } finally { setSaving(false) }
  }

  const secretLabel = cred
    ? `${type === 'ssh_key' ? 'SSH 私鑰' : '密码/Token'}（留空则不修改）`
    : `${type === 'ssh_key' ? 'SSH 私鑰' : '密码/Token'}`

  return (
    <Modal open={open} onClose={onClose} title={cred ? '编辑凭据' : '添加凭据'}>
      <div className="space-y-4">
        <FormField label="凭据名称" required>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="例如：生产服务器 root" />
        </FormField>
        <FormField label="类型" required>
          <Select value={type} onValueChange={v => setType(v as CredentialType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="password">用户名 + 密码</SelectItem>
              <SelectItem value="ssh_key">SSH 私鑰</SelectItem>
              <SelectItem value="token">Token / 访问密钥</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        {type !== 'token' && (
          <FormField label="用户名">
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="root / admin" />
          </FormField>
        )}
        <FormField label={secretLabel} required={!cred}>
          <Textarea
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder={type === 'ssh_key' ? '-----BEGIN RSA PRIVATE KEY-----\n...' : '••••••••'}
            rows={type === 'ssh_key' ? 5 : 1}
            className="font-mono"
          />
        </FormField>
        <p className="text-xs text-muted-foreground">
          🔒 密钥使用 AES-256-GCM 加密存储，展示时自动脱敏
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} loading={saving}>保存</Button>
        </div>
      </div>
    </Modal>
  )
}

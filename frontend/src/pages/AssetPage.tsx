// AssetPage.tsx 资产列表页面（含凭据管理 Task 2.9）
import { useEffect, useState } from 'react'
import { Plus, Search, Server, Database, Wifi, Trash2, Pencil, KeyRound, type LucideProps } from 'lucide-react'
import { useAssetStore } from '@/store/assetStore'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { assetService, credentialService } from '@/services/assetService'
import type { Asset, Credential } from '@/services/assetService'
import type {
  AssetType, CredentialType,
  CreateAssetReq, UpdateAssetReq,
  CreateCredentialReq, UpdateCredentialReq,
} from '@/types/asset'
import { ASSET_TYPE_LABELS, ASSET_DEFAULT_PORTS } from '@/types/asset'

// 资产类型图标映射
const ASSET_ICONS: Record<AssetType, React.FC<LucideProps>> = {
  server: Server,
  mysql: Database,
  redis: Database,
  rocketmq: Wifi,
  rabbitmq: Wifi,
}

// 资产类型颜色
const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  server: '#60a5fa',
  mysql: '#f97316',
  redis: '#ef4444',
  rocketmq: '#8b5cf6',
  rabbitmq: '#f59e0b',
}

type TabType = 'assets' | 'credentials'

export default function AssetPage() {
  const {
    environments, assets, credentials,
    selectedEnvId,
    loadEnvironments, loadAssets, loadCredentials,
    setSelectedEnv,
  } = useAssetStore()

  const [tab, setTab] = useState<TabType>('assets')
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState<AssetType | ''>('')
  const [showAssetForm, setShowAssetForm] = useState(false)
  const [showCredForm, setShowCredForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [editingCred, setEditingCred] = useState<Credential | null>(null)

  useEffect(() => {
    loadEnvironments()
    loadAssets()
    loadCredentials()
  }, [])

  const handleSearch = () => {
    loadAssets({
      environment_id: selectedEnvId ?? undefined,
      type: typeFilter || undefined,
      keyword: keyword || undefined,
    })
  }

  const handleDeleteAsset = async (id: number) => {
    await assetService.delete(id)
    await loadAssets()
  }

  const handleDeleteCred = async (id: number) => {
    await credentialService.delete(id)
    await loadCredentials()
  }

  return (
    <div className="space-y-5" style={{ animation: 'var(--animate-fade-in)' }}>
      {/* 页面标题与 Tab */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-secondary)' }}>
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

        <button
          onClick={() => tab === 'assets'
            ? (setEditingAsset(null), setShowAssetForm(true))
            : (setEditingCred(null), setShowCredForm(true))
          }
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-primary-foreground)',
          }}
        >
          <Plus className="w-4 h-4" />
          {tab === 'assets' ? '添加资产' : '添加凭据'}
        </button>
      </div>

      {/* 资产列表 Tab */}
      {tab === 'assets' && (
        <>
          {/* 筛选栏 */}
          <div className="flex gap-2">
            {/* 环境筛选 */}
            <select
              value={selectedEnvId ?? ''}
              onChange={e => {
                const v = e.target.value ? Number(e.target.value) : null
                setSelectedEnv(v)
              }}
              className="px-3 py-2 rounded-md text-sm border outline-none"
              style={{
                backgroundColor: 'var(--color-card)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            >
              <option value="">全部环境</option>
              {environments.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>

            {/* 类型筛选 */}
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as AssetType | '')}
              className="px-3 py-2 rounded-md text-sm border outline-none"
              style={{
                backgroundColor: 'var(--color-card)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            >
              <option value="">全部类型</option>
              {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {/* 关键字搜索 */}
            <div className="flex-1 flex items-center gap-2 px-3 rounded-md border"
              style={{
                backgroundColor: 'var(--color-card)',
                borderColor: 'var(--color-border)',
              }}
            >
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="搜索名称或 Host..."
                className="flex-1 py-2 text-sm outline-none bg-transparent"
                style={{ color: 'var(--color-foreground)' }}
              />
            </div>

            <button
              onClick={handleSearch}
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{
                backgroundColor: 'var(--color-secondary)',
                color: 'var(--color-secondary-foreground)',
              }}
            >
              搜索
            </button>
          </div>

          {/* 资产表格 */}
          <div
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--color-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                  {['资产名称', '类型', 'Host', '端口', '环境', '状态', '操作'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium"
                      style={{ color: 'var(--color-muted-foreground)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm"
                      style={{ color: 'var(--color-muted-foreground)' }}
                    >
                      暂无资产，点击「添加资产」开始
                    </td>
                  </tr>
                ) : (
                  assets.map(asset => {
                    const assetType = asset.type as AssetType
                    const Icon = ASSET_ICONS[assetType]
                    const color = ASSET_TYPE_COLORS[assetType]
                    return (
                      <tr
                        key={asset.id}
                        className="border-t"
                        style={{
                          borderColor: 'var(--color-border)',
                          backgroundColor: 'var(--color-card)',
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                            <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>
                              {asset.name}
                            </span>
                          </div>
                          {asset.tags?.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {asset.tags.map(t => (
                                <span
                                  key={t}
                                  className="text-[10px] px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: 'var(--color-accent)',
                                    color: 'var(--color-muted-foreground)',
                                  }}
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: color + '20', color }}
                          >
                            {ASSET_TYPE_LABELS[assetType]}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-foreground)' }}>
                          {asset.host}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                          {asset.port}
                        </td>
                        <td className="px-4 py-3">
                          {asset.environment && (
                            <span className="flex items-center gap-1 text-xs">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: asset.environment.color }}
                              />
                              <span style={{ color: 'var(--color-muted-foreground)' }}>
                                {asset.environment.name}
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={asset.status as import('@/types/asset').AssetStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditingAsset(asset); setShowAssetForm(true) }}
                              className="p-1.5 rounded hover:opacity-80"
                              style={{ color: 'var(--color-muted-foreground)' }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <ConfirmDialog
                              title="删除资产"
                              description={`确定要删除资产「${asset.name}」吗？`}
                              confirmText="删除"
                              danger
                              onConfirm={() => handleDeleteAsset(asset.id)}
                            >
                              {open => (
                                <button
                                  onClick={open}
                                  className="p-1.5 rounded hover:opacity-80"
                                  style={{ color: 'var(--color-muted-foreground)' }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </ConfirmDialog>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 凭据管理 Tab（Task 2.9） */}
      {tab === 'credentials' && (
        <div
          className="rounded-lg border overflow-hidden"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                {['名称', '类型', '用户名', '密钥', '操作'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium"
                    style={{ color: 'var(--color-muted-foreground)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {credentials.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                    暂无凭据，点击「添加凭据」开始
                  </td>
                </tr>
              ) : (
                credentials.map(cred => (
                  <tr
                    key={cred.id}
                    className="border-t"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4" style={{ color: '#60a5fa' }} />
                        <span className="font-medium" style={{ color: 'var(--color-foreground)' }}>
                          {cred.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'var(--color-secondary)',
                          color: 'var(--color-muted-foreground)',
                        }}
                      >
                        {cred.type === 'password' ? '密码' : cred.type === 'ssh_key' ? 'SSH 密钥' : 'Token'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-foreground)' }}>
                      {cred.username || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                      {cred.secret_masked}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingCred(cred); setShowCredForm(true) }}
                          className="p-1.5 rounded"
                          style={{ color: 'var(--color-muted-foreground)' }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <ConfirmDialog
                          title="删除凭据"
                          description={`确定要删除凭据「${cred.name}」吗？关联资产将失去连接凭据。`}
                          confirmText="删除"
                          danger
                          onConfirm={() => handleDeleteCred(cred.id)}
                        >
                          {open => (
                            <button onClick={open} className="p-1.5 rounded" style={{ color: 'var(--color-muted-foreground)' }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </ConfirmDialog>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 资产表单弹窗 */}
      {showAssetForm && (
        <AssetFormModal
          asset={editingAsset}
          environments={environments}
          credentials={credentials}
          onClose={() => setShowAssetForm(false)}
          onSave={async (data) => {
            if (editingAsset) {
              await assetService.update({ id: editingAsset.id, ...data } as UpdateAssetReq)
            } else {
              await assetService.create(data as CreateAssetReq)
            }
            await loadAssets()
            setShowAssetForm(false)
          }}
        />
      )}

      {/* 凭据表单弹窗 */}
      {showCredForm && (
        <CredFormModal
          cred={editingCred}
          onClose={() => setShowCredForm(false)}
          onSave={async (data) => {
            if (editingCred) {
              await credentialService.update({ id: editingCred.id, ...data } as UpdateCredentialReq)
            } else {
              await credentialService.create(data as CreateCredentialReq)
            }
            await loadCredentials()
            setShowCredForm(false)
          }}
        />
      )}
    </div>
  )
}

// ── 资产表单弹窗 ──────────────────────────────────────

interface AssetFormModalProps {
  asset: Asset | null
  environments: import('@/types/asset').Environment[]
  credentials: Credential[]
  onClose: () => void
  onSave: (data: Partial<CreateAssetReq & UpdateAssetReq>) => Promise<void>
}

function AssetFormModal({ asset, environments, credentials, onClose, onSave }: AssetFormModalProps) {
  const [envId, setEnvId] = useState<number>(asset?.environment_id ?? (environments[0]?.id ?? 0))
  const [type, setType] = useState<AssetType>((asset?.type as AssetType) ?? 'server')
  const [name, setName] = useState(asset?.name ?? '')
  const [host, setHost] = useState(asset?.host ?? '')
  const [port, setPort] = useState(asset?.port ?? ASSET_DEFAULT_PORTS['server'])
  const [description, setDescription] = useState(asset?.description ?? '')
  const [tagInput, setTagInput] = useState(asset?.tags?.join(', ') ?? '')
  const [credId, setCredId] = useState<number | undefined>(asset?.credential_id)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // 切换类型时自动更新默认端口（仅在新建时）
  const handleTypeChange = (t: AssetType) => {
    setType(t)
    if (!asset) setPort(ASSET_DEFAULT_PORTS[t])
  }

  const handleSubmit = async () => {
    if (!name.trim()) { setErr('资产名称不能为空'); return }
    if (!host.trim()) { setErr('Host 不能为空'); return }
    if (!envId) { setErr('请选择环境'); return }
    setSaving(true)
    try {
      const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
      await onSave({
        environment_id: envId,
        type,
        name: name.trim(),
        host: host.trim(),
        port,
        description,
        tags,
        credential_id: credId,
      })
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={asset ? '编辑资产' : '添加资产'} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="环境 *">
            <select
              value={envId}
              onChange={e => setEnvId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md text-sm border outline-none"
              style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
            >
              {environments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </FormField>
          <FormField label="类型 *">
            <select
              value={type}
              onChange={e => handleTypeChange(e.target.value as AssetType)}
              className="w-full px-3 py-2 rounded-md text-sm border outline-none"
              style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
            >
              {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </FormField>
        </div>

        <FormField label="名称 *">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="资产显示名称"
            className="w-full px-3 py-2 rounded-md text-sm border outline-none"
            style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} />
        </FormField>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <FormField label="Host *">
              <input value={host} onChange={e => setHost(e.target.value)} placeholder="IP 或域名"
                className="w-full px-3 py-2 rounded-md text-sm border outline-none"
                style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} />
            </FormField>
          </div>
          <FormField label="端口">
            <input type="number" value={port} onChange={e => setPort(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md text-sm border outline-none"
              style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} />
          </FormField>
        </div>

        <FormField label="凭据">
          <select
            value={credId ?? ''}
            onChange={e => setCredId(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-3 py-2 rounded-md text-sm border outline-none"
            style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
          >
            <option value="">不绑定凭据</option>
            {credentials.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
          </select>
        </FormField>

        <FormField label="标签（逗号分隔）">
          <input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="web, nginx, proxy"
            className="w-full px-3 py-2 rounded-md text-sm border outline-none"
            style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} />
        </FormField>

        <FormField label="描述">
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="可选"
            className="w-full px-3 py-2 rounded-md text-sm border outline-none"
            style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} />
        </FormField>

        {err && <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{err}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-md text-sm border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
            取消
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-3 py-1.5 rounded-md text-sm font-medium"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)', opacity: saving ? 0.7 : 1 }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── 凭据表单弹窗（含脱敏说明）──────────────────────────

interface CredFormModalProps {
  cred: Credential | null
  onClose: () => void
  onSave: (data: Partial<CreateCredentialReq & UpdateCredentialReq>) => Promise<void>
}

function CredFormModal({ cred, onClose, onSave }: CredFormModalProps) {
  const [name, setName] = useState(cred?.name ?? '')
  const [type, setType] = useState<CredentialType>((cred?.type as CredentialType) ?? 'password')
  const [username, setUsername] = useState(cred?.username ?? '')
  const [secret, setSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) { setErr('凭据名称不能为空'); return }
    if (!cred && !secret) { setErr('密钥/密码不能为空'); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), type, username, secret })
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={cred ? '编辑凭据' : '添加凭据'} onClose={onClose}>
      <div className="space-y-4">
        <FormField label="凭据名称 *">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="例如：生产服务器 root"
            className="w-full px-3 py-2 rounded-md text-sm border outline-none"
            style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} />
        </FormField>
        <FormField label="类型 *">
          <select value={type} onChange={e => setType(e.target.value as CredentialType)}
            className="w-full px-3 py-2 rounded-md text-sm border outline-none"
            style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
            <option value="password">用户名 + 密码</option>
            <option value="ssh_key">SSH 私钥</option>
            <option value="token">Token / 访问密钥</option>
          </select>
        </FormField>
        {type !== 'token' && (
          <FormField label="用户名">
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="root / admin"
              className="w-full px-3 py-2 rounded-md text-sm border outline-none"
              style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }} />
          </FormField>
        )}
        <FormField label={cred ? `${type === 'ssh_key' ? 'SSH 私钥' : '密码/Token'}（留空则不修改）` : `${type === 'ssh_key' ? 'SSH 私钥' : '密码/Token'} *`}>
          <textarea
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder={type === 'ssh_key' ? '-----BEGIN RSA PRIVATE KEY-----\n...' : '••••••••'}
            rows={type === 'ssh_key' ? 5 : 1}
            className="w-full px-3 py-2 rounded-md text-sm border outline-none resize-none font-mono"
            style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
          />
        </FormField>
        {/* 安全提示 */}
        <p className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
          🔒 密钥将使用 AES-256-GCM 加密存储，展示时自动脱敏
        </p>
        {err && <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 rounded-md text-sm border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
            取消
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-3 py-1.5 rounded-md text-sm font-medium"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-foreground)', opacity: saving ? 0.7 : 1 }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── 公共弹窗和表单字段组件 ────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div
        className="relative z-10 rounded-lg border p-6 w-full max-w-lg shadow-xl"
        style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
      >
        <h3 className="text-base font-semibold mb-5" style={{ color: 'var(--color-foreground)' }}>{title}</h3>
        {children}
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-muted-foreground)' }}>{label}</label>
      {children}
    </div>
  )
}

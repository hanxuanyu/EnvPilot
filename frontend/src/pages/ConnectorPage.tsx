import { useEffect, useMemo, useState } from 'react'
import { Cable, RefreshCw } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAssetStore } from '@/store/assetStore'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ConnectorAssetSidebar } from '@/components/connector/ConnectorAssetSidebar'
import { ConnectorTabs } from '@/components/connector/ConnectorTabs'
import { SQLConnectorPanel } from '@/components/connector/SQLConnectorPanel'
import { RedisConnectorPanel } from '@/components/connector/RedisConnectorPanel'
import { RabbitMQConnectorPanel } from '@/components/connector/RabbitMQConnectorPanel'
import { KafkaConnectorPanel } from '@/components/connector/KafkaConnectorPanel'
import { RocketMQConnectorPanel } from '@/components/connector/RocketMQConnectorPanel'
import type { Asset } from '@/types/asset'
import type { ConnectorTabKey } from '@/types/connector'

const TAB_KEYS: ConnectorTabKey[] = ['database', 'cache', 'mq']
const DATABASE_TYPES = new Set(['mysql', 'postgresql'])
const CACHE_TYPES = new Set(['redis'])
const MQ_TYPES = new Set(['rabbitmq', 'kafka', 'rocketmq'])

function normalizeTab(value?: string): ConnectorTabKey {
  return TAB_KEYS.includes(value as ConnectorTabKey) ? (value as ConnectorTabKey) : 'database'
}

function matchesTab(asset: Asset, tab: ConnectorTabKey): boolean {
  if (tab === 'database') return asset.category === 'database' && DATABASE_TYPES.has(asset.plugin_type)
  if (tab === 'cache') return asset.category === 'cache' && CACHE_TYPES.has(asset.plugin_type)
  return asset.category === 'mq' && MQ_TYPES.has(asset.plugin_type)
}

function renderPanel(asset: Asset | null) {
  if (!asset) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
        当前分类下没有可操作资产，请先在左侧选择或创建资产
      </div>
    )
  }

  if (DATABASE_TYPES.has(asset.plugin_type)) return <SQLConnectorPanel asset={asset} />
  if (asset.plugin_type === 'redis') return <RedisConnectorPanel asset={asset} />
  if (asset.plugin_type === 'rabbitmq') return <RabbitMQConnectorPanel asset={asset} />
  if (asset.plugin_type === 'kafka') return <KafkaConnectorPanel asset={asset} />
  if (asset.plugin_type === 'rocketmq') return <RocketMQConnectorPanel asset={asset} />

  return (
    <div className="rounded-xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
      当前资产类型 {asset.plugin_type} 暂未接入独立面板
    </div>
  )
}

export default function ConnectorPage() {
  const navigate = useNavigate()
  const { type } = useParams()
  const {
    environments,
    assets,
    selectedEnvId,
    loading,
    loadEnvironments,
    loadAssets,
    setSelectedEnv,
  } = useAssetStore()

  const activeTab = normalizeTab(type)
  const [keyword, setKeyword] = useState('')
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null)

  useEffect(() => {
    loadEnvironments()
    loadAssets()
  }, [])

  const counts = useMemo(
    () => ({
      database: assets.filter(asset => matchesTab(asset, 'database')).length,
      cache: assets.filter(asset => matchesTab(asset, 'cache')).length,
      mq: assets.filter(asset => matchesTab(asset, 'mq')).length,
    }),
    [assets],
  )

  const visibleAssets = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return assets.filter((asset) => {
      if (!matchesTab(asset, activeTab)) return false
      if (selectedEnvId && asset.environment_id !== selectedEnvId) return false
      if (!normalizedKeyword) return true
      return [asset.name, asset.plugin_type, JSON.stringify(asset.ext_config ?? {})]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword)
    })
  }, [activeTab, assets, keyword, selectedEnvId])

  useEffect(() => {
    if (!visibleAssets.length) {
      setSelectedAssetId(null)
      return
    }
    if (!selectedAssetId || !visibleAssets.some(asset => asset.id === selectedAssetId)) {
      setSelectedAssetId(visibleAssets[0].id)
    }
  }, [selectedAssetId, visibleAssets])

  const selectedAsset = useMemo(
    () => visibleAssets.find(asset => asset.id === selectedAssetId) ?? null,
    [selectedAssetId, visibleAssets],
  )

  useEffect(() => {
    setKeyword('')
    setSelectedAssetId(null)
  }, [activeTab])

  const refreshAssets = async () => {
    await Promise.all([loadEnvironments(), loadAssets()])
  }

  return (
    <div className="space-y-5 animate-in fade-in-0 duration-200">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Cable className="h-6 w-6 text-primary" />
            中间件连接器
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            按数据库、缓存、消息队列分区管理连接操作，每种中间件都有独立工作面板。
          </p>
        </div>
        <Button variant="outline" onClick={refreshAssets} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新资产
        </Button>
      </div>

      <ConnectorTabs
        active={activeTab}
        counts={counts}
        onChange={(tab) => navigate(`/connector/${tab}`)}
      />

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">筛选环境</div>
              <Select
                value={selectedEnvId?.toString() ?? '__all__'}
                onValueChange={async (value) => {
                  const next = value === '__all__' ? null : Number(value)
                  setSelectedEnv(next)
                  await loadAssets({ environment_id: next ?? undefined })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部环境" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部环境</SelectItem>
                  {environments.map((env) => (
                    <SelectItem key={env.id} value={env.id.toString()}>{env.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ConnectorAssetSidebar
            title="可用资产"
            keyword={keyword}
            onKeywordChange={setKeyword}
            assets={visibleAssets}
            selectedAssetId={selectedAssetId}
            onSelect={setSelectedAssetId}
          />
        </div>

        <div className="min-w-0">
          {renderPanel(selectedAsset)}
        </div>
      </div>
    </div>
  )
}

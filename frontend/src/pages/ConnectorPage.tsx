import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Cable, Database, Play, RefreshCw, Server, TableProperties, TerminalSquare, Wifi,
} from 'lucide-react'
import { useAssetStore } from '@/store/assetStore'
import { connectorService } from '@/services/connectorService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Asset, AssetCategory } from '@/types/asset'
import type { CommandResult, QueryResult } from '@/types/connector'
import { CATEGORY_LABELS, getAssetAddress } from '@/types/asset'

const SUPPORTED_TYPES = new Set(['mysql', 'postgresql', 'redis'])

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function ResultTable({ result }: { result: QueryResult | null }) {
  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
        执行只读 SQL 后将在这里显示结果集
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
        <span className="text-muted-foreground">返回 {result.rows.length} 行</span>
        <span className="text-muted-foreground">耗时 {result.duration_ms}ms</span>
      </div>
      <div className="overflow-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/60">
              {result.columns.map((column) => (
                <th key={column.name} className="px-4 py-3 text-left font-medium text-foreground">
                  <div>{column.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">{column.type || 'UNKNOWN'}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(result.columns.length, 1)} className="px-4 py-8 text-center text-muted-foreground">
                  查询成功，但没有返回数据
                </td>
              </tr>
            ) : result.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-border align-top">
                {result.columns.map((column) => (
                  <td key={column.name} className="px-4 py-3 text-foreground">
                    <pre className="whitespace-pre-wrap break-all font-sans">{pretty(row[column.name])}</pre>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AssetListItem({
  asset,
  active,
  onClick,
}: {
  asset: Asset
  active: boolean
  onClick: () => void
}) {
  const isRedis = asset.plugin_type === 'redis'
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition-colors ${
        active
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:bg-accent/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-foreground">{asset.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">{getAssetAddress(asset)}</div>
        </div>
        <Badge variant="outline">{isRedis ? 'Redis' : asset.plugin_type}</Badge>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{CATEGORY_LABELS[asset.category as AssetCategory]}</span>
        {asset.environment?.name && <span>· {asset.environment.name}</span>}
      </div>
    </button>
  )
}

export default function ConnectorPage() {
  const {
    environments,
    assets,
    selectedEnvId,
    loading,
    loadEnvironments,
    loadAssets,
    setSelectedEnv,
  } = useAssetStore()

  const [keyword, setKeyword] = useState('')
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null)
  const [testing, setTesting] = useState(false)
  const [running, setRunning] = useState(false)
  const [loadingDatabases, setLoadingDatabases] = useState(false)
  const [loadingTables, setLoadingTables] = useState(false)
  const [database, setDatabase] = useState('')
  const [sql, setSQL] = useState('SELECT 1 AS ok')
  const [sqlLimit, setSQLLimit] = useState('200')
  const [redisCommand, setRedisCommand] = useState('GET')
  const [redisArgs, setRedisArgs] = useState('sample:key')
  const [databases, setDatabases] = useState<string[]>([])
  const [tables, setTables] = useState<string[]>([])
  const [sqlResult, setSQLResult] = useState<QueryResult | null>(null)
  const [redisResult, setRedisResult] = useState<CommandResult | null>(null)
  const [lastStatus, setLastStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [lastMessage, setLastMessage] = useState('')

  useEffect(() => {
    loadEnvironments()
    loadAssets()
  }, [])

  const supportedAssets = useMemo(
    () => assets.filter(asset => SUPPORTED_TYPES.has(asset.plugin_type)),
    [assets],
  )

  const visibleAssets = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    return supportedAssets.filter((asset) => {
      if (selectedEnvId && asset.environment_id !== selectedEnvId) return false
      if (!normalizedKeyword) return true
      return [asset.name, asset.plugin_type, getAssetAddress(asset)]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword)
    })
  }, [keyword, selectedEnvId, supportedAssets])

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
    setDatabases([])
    setTables([])
    setSQLResult(null)
    setRedisResult(null)
    setLastStatus('idle')
    setLastMessage('')
    setDatabase((selectedAsset?.ext_config?.database as string | undefined) ?? '')
  }, [selectedAssetId])

  const isDatabaseAsset = selectedAsset?.category === 'database'
  const isRedisAsset = selectedAsset?.plugin_type === 'redis'

  const refreshAssets = async () => {
    await Promise.all([loadEnvironments(), loadAssets()])
  }

  const handleTestConnection = async () => {
    if (!selectedAsset) return
    setTesting(true)
    try {
      await connectorService.testConnection(selectedAsset.id)
      setLastStatus('success')
      setLastMessage('连接测试成功')
      toast.success(`${selectedAsset.name} 连接正常`)
    } catch (error: any) {
      setLastStatus('error')
      setLastMessage(error.message || '连接测试失败')
      toast.error('连接测试失败', { description: error.message })
    } finally {
      setTesting(false)
    }
  }

  const handleLoadDatabases = async () => {
    if (!selectedAsset || !isDatabaseAsset) return
    setLoadingDatabases(true)
    try {
      const result = await connectorService.listDatabases(selectedAsset.id)
      setDatabases(result)
      if (!database && result.length > 0) setDatabase(result[0])
    } catch (error: any) {
      toast.error('加载数据库列表失败', { description: error.message })
    } finally {
      setLoadingDatabases(false)
    }
  }

  const handleLoadTables = async () => {
    if (!selectedAsset || !isDatabaseAsset) return
    setLoadingTables(true)
    try {
      const result = await connectorService.listTables(selectedAsset.id, database)
      setTables(result)
    } catch (error: any) {
      toast.error('加载数据表失败', { description: error.message })
    } finally {
      setLoadingTables(false)
    }
  }

  const handleExecuteSQL = async () => {
    if (!selectedAsset || !isDatabaseAsset) return
    setRunning(true)
    try {
      const result = await connectorService.executeSQL({
        asset_id: selectedAsset.id,
        database,
        query: sql,
        limit: Number(sqlLimit) || 200,
      })
      setSQLResult(result)
      setRedisResult(null)
      setLastStatus('success')
      setLastMessage('SQL 执行成功')
    } catch (error: any) {
      setLastStatus('error')
      setLastMessage(error.message || 'SQL 执行失败')
      toast.error('SQL 执行失败', { description: error.message })
    } finally {
      setRunning(false)
    }
  }

  const handleExecuteRedis = async () => {
    if (!selectedAsset || !isRedisAsset) return
    setRunning(true)
    try {
      const result = await connectorService.executeRedisCmd({
        asset_id: selectedAsset.id,
        command: redisCommand,
        args: redisArgs.split(/\s+/).filter(Boolean),
      })
      setRedisResult(result)
      setSQLResult(null)
      setLastStatus('success')
      setLastMessage('Redis 命令执行成功')
    } catch (error: any) {
      setLastStatus('error')
      setLastMessage(error.message || 'Redis 命令执行失败')
      toast.error('Redis 命令执行失败', { description: error.message })
    } finally {
      setRunning(false)
    }
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
            当前已支持 MySQL、PostgreSQL、Redis 的连接测试与基础操作。
          </p>
        </div>
        <Button variant="outline" onClick={refreshAssets} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新资产
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">筛选资产</div>
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
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索资产名或地址"
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-foreground">可用资产</div>
              <Badge variant="outline">{visibleAssets.length}</Badge>
            </div>
            <div className="space-y-2 max-h-[640px] overflow-y-auto">
              {visibleAssets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  当前没有可用于连接器的资产
                </div>
              ) : visibleAssets.map(asset => (
                <AssetListItem
                  key={asset.id}
                  asset={asset}
                  active={asset.id === selectedAssetId}
                  onClick={() => setSelectedAssetId(asset.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          {selectedAsset ? (
            <>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {isDatabaseAsset ? <Database className="h-5 w-5 text-primary" /> : <Server className="h-5 w-5 text-primary" />}
                      <h2 className="text-lg font-semibold text-foreground">{selectedAsset.name}</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline">{selectedAsset.plugin_type}</Badge>
                      <span>{getAssetAddress(selectedAsset)}</span>
                      {selectedAsset.environment?.name && <span>· {selectedAsset.environment.name}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleTestConnection} loading={testing}>
                      <Wifi className="h-4 w-4" />
                      测试连接
                    </Button>
                    {isDatabaseAsset && (
                      <Button variant="outline" onClick={handleLoadDatabases} loading={loadingDatabases}>
                        <Database className="h-4 w-4" />
                        加载数据库
                      </Button>
                    )}
                    {isDatabaseAsset && (
                      <Button variant="outline" onClick={handleLoadTables} loading={loadingTables}>
                        <TableProperties className="h-4 w-4" />
                        加载数据表
                      </Button>
                    )}
                  </div>
                </div>

                {lastMessage && (
                  <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                    lastStatus === 'success'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-red-500/30 bg-red-500/10 text-red-300'
                  }`}>
                    {lastMessage}
                  </div>
                )}
              </div>

              {isDatabaseAsset ? (
                <div className="grid gap-4 2xl:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                      <div className="text-sm font-medium text-foreground">连接上下文</div>
                      <Input
                        value={database}
                        onChange={(e) => setDatabase(e.target.value)}
                        placeholder="数据库名，可留空"
                      />
                      <Input
                        value={sqlLimit}
                        onChange={(e) => setSQLLimit(e.target.value)}
                        placeholder="结果行数限制"
                        inputMode="numeric"
                      />
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                      <div className="text-sm font-medium text-foreground">数据库列表</div>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {databases.length === 0 ? (
                          <div className="text-sm text-muted-foreground">点击“加载数据库”获取</div>
                        ) : databases.map((item) => (
                          <button
                            key={item}
                            onClick={() => setDatabase(item)}
                            className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                              database === item ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground'
                            }`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                      <div className="text-sm font-medium text-foreground">数据表列表</div>
                      <div className="max-h-72 overflow-y-auto space-y-2">
                        {tables.length === 0 ? (
                          <div className="text-sm text-muted-foreground">点击“加载数据表”获取</div>
                        ) : tables.map((item) => (
                          <div key={item} className="rounded-md border border-border px-3 py-2 text-sm text-foreground">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 min-w-0">
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-foreground">只读 SQL</div>
                          <div className="text-xs text-muted-foreground">允许 SELECT / SHOW / DESC / EXPLAIN / 只读 WITH</div>
                        </div>
                        <Button onClick={handleExecuteSQL} loading={running}>
                          <Play className="h-4 w-4" />
                          执行查询
                        </Button>
                      </div>
                      <Textarea
                        value={sql}
                        onChange={(e) => setSQL(e.target.value)}
                        className="min-h-[180px] font-mono text-sm"
                        placeholder="SELECT * FROM your_table LIMIT 20"
                      />
                    </div>
                    <ResultTable result={sqlResult} />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <TerminalSquare className="h-4 w-4" />
                          Redis 命令
                        </div>
                        <div className="text-xs text-muted-foreground">仅开放只读命令，参数按空格分隔</div>
                      </div>
                      <Button onClick={handleExecuteRedis} loading={running}>
                        <Play className="h-4 w-4" />
                        执行命令
                      </Button>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                      <Input
                        value={redisCommand}
                        onChange={(e) => setRedisCommand(e.target.value.toUpperCase())}
                        placeholder="GET"
                      />
                      <Input
                        value={redisArgs}
                        onChange={(e) => setRedisArgs(e.target.value)}
                        placeholder="key 或多参数，使用空格分隔"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="mb-3 text-sm font-medium text-foreground">命令结果</div>
                    {redisResult ? (
                      <pre className="max-h-[520px] overflow-auto rounded-lg bg-secondary/40 p-4 text-sm text-foreground whitespace-pre-wrap break-all">
                        {pretty(redisResult.result)}
                      </pre>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
                        执行 Redis 命令后将在这里显示结果
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/60 px-6 py-20 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Cable className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-medium text-foreground">没有可操作的连接器资产</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                请先创建 MySQL、PostgreSQL 或 Redis 类型资产，并配置好可用凭据。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

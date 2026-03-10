import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ChevronDown,
  Database,
  KeyRound,
  Play,
  Plus,
  RefreshCw,
  Search,
  TerminalSquare,
  Trash2,
  Wifi,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { connectorService } from '@/services/connectorService'
import { getAssetAddress, type Asset, type Environment } from '@/types/asset'
import type {
  CacheCatalog,
  CacheEntry,
  CacheKeyDetail,
  CacheKeyInput,
  CacheKeySummary,
  CacheMutationResult,
  CommandResult,
} from '@/types/connector'
import { prettyValue } from '@/components/connector/utils'

interface RedisConnectorPanelProps {
  asset: Asset | null
  assets: Asset[]
  environments: Environment[]
  selectedEnvId: number | null
  onSelectEnv: (envId: number | null) => Promise<void>
  onSelectAsset: (assetId: number) => void
}

interface SearchableAssetSelectProps {
  assets: Asset[]
  selectedAsset: Asset | null
  onSelect: (assetId: number) => void
}

type CacheMode = 'structured' | 'command'
type CacheValueType = 'string' | 'hash' | 'list' | 'set' | 'zset'

const CACHE_TYPES: CacheValueType[] = ['string', 'hash', 'list', 'set', 'zset']

function formatTTL(ttlSeconds: number) {
  if (ttlSeconds === -1) return '永不过期'
  if (ttlSeconds <= 0) return '已经过期'
  return `${ttlSeconds}s`
}

function simulateTTL(ttlSeconds: number, loadedAt: number | undefined, now: number) {
  if (ttlSeconds < 0 || !loadedAt) return ttlSeconds
  const elapsedSeconds = Math.floor((now - loadedAt) / 1000)
  return Math.max(ttlSeconds - elapsedSeconds, 0)
}

function summarizeKey(item: CacheKeySummary) {
  const preview = item.preview?.trim()
  if (preview) return preview
  if (item.size > 0) return `${item.size} 项`
  return `${item.type} 类型`
}

function parseCommandLine(text: string) {
  const tokens = text.match(/"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\S+/g) ?? []
  return tokens.map((token) => token.replace(/^['"]|['"]$/g, ''))
}

function SearchableAssetSelect({ assets, selectedAsset, onSelect }: SearchableAssetSelectProps) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (!open) setKeyword('')
  }, [open])

  const filteredAssets = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    if (!normalizedKeyword) return assets
    return assets.filter((item) => (
      [item.name, item.plugin_type, item.environment?.name ?? '', getAssetAddress(item)]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword)
    ))
  }, [assets, keyword])

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        className="flex h-9 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-left shadow-sm transition hover:border-primary/40"
        onClick={() => setOpen((current) => !current)}
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium leading-none text-foreground">
            {selectedAsset?.name ?? '选择缓存资产'}
          </div>
          <div className="mt-1 truncate text-[11px] leading-none text-muted-foreground">
            {selectedAsset
              ? `${selectedAsset.environment?.name ?? '未分配环境'} · ${getAssetAddress(selectedAsset)}`
              : '搜索名称、环境或地址'}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-2xl border border-border bg-card p-3 shadow-2xl shadow-black/20">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索资产名、环境、地址"
              className="pl-9"
            />
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {filteredAssets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                没有匹配的缓存资产
              </div>
            ) : filteredAssets.map((item) => {
              const selected = selectedAsset?.id === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item.id)
                    setOpen(false)
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${selected ? 'border-primary bg-primary/8' : 'border-border hover:border-primary/30 hover:bg-accent/40'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{item.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {item.environment?.name ?? '未分配环境'} · {getAssetAddress(item)}
                      </div>
                    </div>
                    <Badge variant="outline">{item.plugin_type}</Badge>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultPanel({ result }: { result: CommandResult | CacheMutationResult | null }) {
  if (!result) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
        执行命令、保存缓存键或删除缓存键后，结果会展示在这里
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="shrink-0 border-b border-border bg-secondary/35 px-4 py-2.5 text-sm text-muted-foreground">
        最近一次操作结果
      </div>
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-all p-4 text-xs leading-5 text-foreground">
        {prettyValue(result)}
      </pre>
    </div>
  )
}

export function RedisConnectorPanel({
  asset,
  assets,
  environments,
  selectedEnvId,
  onSelectEnv,
  onSelectAsset,
}: RedisConnectorPanelProps) {
  const [testing, setTesting] = useState(false)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [runningCommand, setRunningCommand] = useState(false)

  const [catalog, setCatalog] = useState<CacheCatalog | null>(null)
  const [selectedDatabase, setSelectedDatabase] = useState(0)
  const [pattern, setPattern] = useState('*')
  const [keys, setKeys] = useState<CacheKeySummary[]>([])
  const [keyLoadedAtMap, setKeyLoadedAtMap] = useState<Record<string, number>>({})
  const [nextCursor, setNextCursor] = useState(0)
  const [selectedKey, setSelectedKey] = useState('')
  const [selectedKeyDetail, setSelectedKeyDetail] = useState<CacheKeyDetail | null>(null)

  const [mode, setMode] = useState<CacheMode>('structured')
  const [creatingKey, setCreatingKey] = useState(false)
  const [draftKey, setDraftKey] = useState('')
  const [draftType, setDraftType] = useState<CacheValueType>('string')
  const [draftTTL, setDraftTTL] = useState('')
  const [draftStringValue, setDraftStringValue] = useState('')
  const [draftEntries, setDraftEntries] = useState<CacheEntry[]>([{ value: '' }])

  const [commandText, setCommandText] = useState('GET sample:key')
  const [lastResult, setLastResult] = useState<CommandResult | CacheMutationResult | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const selectedDatabaseInfo = useMemo(
    () => catalog?.databases.find((item) => item.index === selectedDatabase) ?? null,
    [catalog, selectedDatabase],
  )

  useEffect(() => {
    setCatalog(null)
    setSelectedDatabase(0)
    setPattern('*')
    setKeys([])
    setKeyLoadedAtMap({})
    setNextCursor(0)
    setSelectedKey('')
    setSelectedKeyDetail(null)
    setMode('structured')
    setCreatingKey(false)
    setDraftKey('')
    setDraftType('string')
    setDraftTTL('')
    setDraftStringValue('')
    setDraftEntries([{ value: '' }])
    setCommandText('GET sample:key')
    setLastResult(null)
  }, [asset?.id])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const loadCatalog = async (preferredDatabase?: number) => {
    if (!asset) return

    setLoadingCatalog(true)
    try {
      const nextCatalog = await connectorService.getCacheCatalog(asset.id)
      setCatalog(nextCatalog)
      const nextDatabase = preferredDatabase
        ?? nextCatalog.databases.find((item) => item.index === selectedDatabase)?.index
        ?? nextCatalog.default_database
        ?? nextCatalog.databases[0]?.index
        ?? 0
      setSelectedDatabase(nextDatabase)
    } catch (error: any) {
      toast.error('加载缓存目录失败', { description: error.message })
    } finally {
      setLoadingCatalog(false)
    }
  }

  const loadKeys = async (options?: { cursor?: number; append?: boolean; database?: number }) => {
    if (!asset) return

    const database = options?.database ?? selectedDatabase
    setLoadingKeys(true)
    try {
      const page = await connectorService.listCacheKeys({
        asset_id: asset.id,
        database,
        pattern: pattern.trim() || '*',
        cursor: options?.cursor ?? 0,
        limit: 100,
      })
      setKeys((current) => options?.append ? [...current, ...page.items] : page.items)
      setKeyLoadedAtMap((current) => {
        const loadedAt = Date.now()
        const nextMap = options?.append ? { ...current } : {}
        page.items.forEach((item) => {
          nextMap[`${database}:${item.key}`] = loadedAt
        })
        return nextMap
      })
      setNextCursor(page.cursor)
      if (!options?.append && page.items.every((item) => item.key !== selectedKey)) {
        setSelectedKey('')
        setSelectedKeyDetail(null)
      }
    } catch (error: any) {
      toast.error('加载缓存键失败', { description: error.message })
    } finally {
      setLoadingKeys(false)
    }
  }

  const loadKeyDetail = async (key: string, database = selectedDatabase) => {
    if (!asset || !key) return

    setLoadingDetail(true)
    try {
      const detail = await connectorService.getCacheKeyDetail({
        asset_id: asset.id,
        database,
        key,
      })
      setSelectedKey(key)
      setSelectedKeyDetail(detail)
      setCreatingKey(false)
      setDraftKey(detail.key)
      setDraftType((CACHE_TYPES.includes(detail.type as CacheValueType) ? detail.type : 'string') as CacheValueType)
      setDraftTTL(detail.ttl_seconds >= 0 ? String(detail.ttl_seconds) : '')
      setDraftStringValue(detail.string_value ?? '')
      setDraftEntries(
        detail.entries && detail.entries.length > 0
          ? detail.entries.map((entry) => ({ field: entry.field ?? '', value: entry.value ?? '', score: entry.score ?? 0 }))
          : [{ value: '' }],
      )
    } catch (error: any) {
      toast.error('加载缓存键详情失败', { description: error.message })
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    if (!asset) return
    void loadCatalog()
  }, [asset?.id])

  useEffect(() => {
    if (!asset || !catalog) return
    void loadKeys({ database: selectedDatabase })
  }, [asset?.id, catalog, selectedDatabase])

  const handleTestConnection = async () => {
    if (!asset) return
    setTesting(true)
    try {
      await connectorService.testConnection(asset.id)
      toast.success(`${asset.name} 连接正常`)
    } catch (error: any) {
      toast.error('连接测试失败', { description: error.message })
    } finally {
      setTesting(false)
    }
  }

  const handleCreateNewKey = () => {
    setMode('structured')
    setCreatingKey(true)
    setSelectedKey('')
    setSelectedKeyDetail(null)
    setDraftKey('')
    setDraftType('string')
    setDraftTTL('')
    setDraftStringValue('')
    setDraftEntries([{ value: '' }])
  }

  const handleDraftTypeChange = (value: CacheValueType) => {
    setDraftType(value)
    if (value === 'hash') {
      setDraftEntries([{ field: '', value: '', score: 0 }])
      return
    }
    if (value === 'zset') {
      setDraftEntries([{ value: '', score: 0 }])
      return
    }
    setDraftEntries([{ value: '' }])
  }

  const updateEntry = (index: number, patch: Partial<CacheEntry>) => {
    setDraftEntries((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry))
  }

  const addEntry = () => {
    setDraftEntries((current) => [...current, draftType === 'hash' ? { field: '', value: '' } : { value: '', score: 0 }])
  }

  const removeEntry = (index: number) => {
    setDraftEntries((current) => current.length === 1 ? current : current.filter((_, entryIndex) => entryIndex !== index))
  }

  const handleSaveKey = async () => {
    if (!asset) return

    const input: CacheKeyInput = {
      database: selectedDatabase,
      key: draftKey.trim(),
      type: draftType,
    }

    if (!input.key) {
      toast.error('缓存键名不能为空')
      return
    }

    if (draftTTL.trim()) {
      const ttlNumber = Number(draftTTL)
      if (Number.isNaN(ttlNumber)) {
        toast.error('TTL 必须为数字')
        return
      }
      input.ttl_seconds = ttlNumber
    }

    if (draftType === 'string') {
      input.string_value = draftStringValue
    } else if (draftType === 'hash') {
      input.entries = draftEntries
        .filter((entry) => entry.field?.trim())
        .map((entry) => ({ field: entry.field?.trim(), value: entry.value ?? '' }))
    } else if (draftType === 'zset') {
      input.entries = draftEntries
        .filter((entry) => (entry.value ?? '').trim())
        .map((entry) => ({ value: entry.value?.trim(), score: Number(entry.score ?? 0) }))
    } else {
      input.entries = draftEntries
        .filter((entry) => (entry.value ?? '').trim())
        .map((entry) => ({ value: entry.value?.trim() }))
    }

    setSaving(true)
    try {
      const result = await connectorService.saveCacheKey({ asset_id: asset.id, input })
      setLastResult(result)
      toast.success(result.summary || '缓存键保存成功')
      await loadCatalog(selectedDatabase)
      await loadKeys({ database: selectedDatabase })
      await loadKeyDetail(input.key, selectedDatabase)
    } catch (error: any) {
      toast.error('缓存键保存失败', { description: error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteKey = async () => {
    if (!asset || !selectedKeyDetail) return

    setDeleting(true)
    try {
      const result = await connectorService.deleteCacheKey({
        asset_id: asset.id,
        database: selectedDatabase,
        key: selectedKeyDetail.key,
      })
      setLastResult(result)
      toast.success(result.summary || '缓存键删除成功')
      setSelectedKey('')
      setSelectedKeyDetail(null)
      setCreatingKey(false)
      await loadCatalog(selectedDatabase)
      await loadKeys({ database: selectedDatabase })
    } catch (error: any) {
      toast.error('缓存键删除失败', { description: error.message })
    } finally {
      setDeleting(false)
    }
  }

  const handleRunCommand = async () => {
    if (!asset) return

    const parts = parseCommandLine(commandText)
    if (parts.length === 0) {
      toast.error('Redis 命令不能为空')
      return
    }

    setRunningCommand(true)
    try {
      const [command, ...args] = parts
      const result = await connectorService.executeRedisCmd({
        asset_id: asset.id,
        database: selectedDatabase,
        command,
        args,
      })
      setLastResult(result)
      toast.success('Redis 命令执行成功')
      await loadCatalog(selectedDatabase)
      await loadKeys({ database: selectedDatabase })
      if (selectedKey) {
        await loadKeyDetail(selectedKey, selectedDatabase)
      }
    } catch (error: any) {
      toast.error('Redis 命令执行失败', { description: error.message })
    } finally {
      setRunningCommand(false)
    }
  }

  if (!asset) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
        当前缓存分类下没有可操作资产，请先选择或创建 Redis 资产
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[28px] border border-border/70 bg-gradient-to-br from-card via-card to-card/80 shadow-sm">
      <div className="sticky top-0 z-10 shrink-0 border-b border-border/70 bg-card/95 px-4 py-3 backdrop-blur">
        <div className="grid gap-3 xl:grid-cols-[170px_minmax(0,320px)_auto] 2xl:grid-cols-[180px_minmax(0,360px)_auto]">
          <Select
            value={selectedEnvId?.toString() ?? '__all__'}
            onValueChange={(value) => {
              const next = value === '__all__' ? null : Number(value)
              void onSelectEnv(next)
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="全部环境" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部环境</SelectItem>
              {environments.map((env) => (
                <SelectItem key={env.id} value={env.id.toString()}>{env.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <SearchableAssetSelect assets={assets} selectedAsset={asset} onSelect={onSelectAsset} />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="outline" className="h-8 px-2.5">Redis</Badge>
            <Button size="sm" variant="outline" onClick={handleTestConnection} loading={testing}>
              <Wifi className="h-3.5 w-3.5" />
              测试连接
            </Button>
            <Button size="sm" variant="outline" onClick={() => { void loadCatalog(selectedDatabase); void loadKeys({ database: selectedDatabase }) }} loading={loadingCatalog || loadingKeys}>
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 items-stretch gap-4 overflow-hidden px-4 py-4 xl:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="min-h-0 min-w-0 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain pr-2">
            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-foreground">缓存库</div>
                  <div className="text-xs text-muted-foreground">选择 DB 并浏览键空间</div>
                </div>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleCreateNewKey}>
                  <Plus className="h-3.5 w-3.5" />
                  新建键
                </Button>
              </div>

              <div className="space-y-2">
                {catalog?.databases.length ? catalog.databases.map((item) => {
                  const active = item.index === selectedDatabase
                  return (
                    <button
                      key={item.index}
                      type="button"
                      onClick={() => setSelectedDatabase(item.index)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${active ? 'border-primary bg-primary/8' : 'border-border hover:border-primary/30 hover:bg-accent/40'}`}
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">{item.name}</div>
                        <div className="text-[11px] text-muted-foreground">{item.key_count} keys</div>
                      </div>
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )
                }) : (
                  <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    {loadingCatalog ? '正在加载缓存目录...' : '暂无可用缓存库'}
                  </div>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-card p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-foreground">键列表</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedDatabaseInfo ? `${selectedDatabaseInfo.name} · ${selectedDatabaseInfo.key_count} keys` : '当前 DB'}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { void loadKeys({ database: selectedDatabase }) }} loading={loadingKeys}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  刷新键
                </Button>
              </div>

              <div className="mb-3 flex gap-2">
                <Input value={pattern} onChange={(event) => setPattern(event.target.value)} placeholder="键模式，例如 user:*" className="h-8 text-xs" />
                <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => { void loadKeys({ database: selectedDatabase }) }}>
                  <Search className="h-3.5 w-3.5" />
                  搜索
                </Button>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {keys.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    {loadingKeys ? '正在加载缓存键...' : '当前条件下没有匹配的缓存键'}
                  </div>
                ) : keys.map((item) => {
                  const active = !creatingKey && selectedKey === item.key
                  const ttl = simulateTTL(item.ttl_seconds, keyLoadedAtMap[`${selectedDatabase}:${item.key}`], now)
                  const ttlExpired = item.ttl_seconds >= 0 && ttl <= 0
                  return (
                    <button
                      key={`${item.key}:${item.type}`}
                      type="button"
                      onClick={() => { void loadKeyDetail(item.key, selectedDatabase) }}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition ${active ? 'border-primary bg-primary/8' : 'border-border hover:border-primary/30 hover:bg-accent/40'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">{item.key}</div>
                          <div className="mt-1 truncate text-[11px] text-muted-foreground">{summarizeKey(item)}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase">{item.type}</Badge>
                          <span className={`text-[10px] ${ttlExpired ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                            TTL {formatTTL(ttl)}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {nextCursor > 0 ? (
                <div className="mt-3 shrink-0">
                  <Button size="sm" variant="outline" className="h-8 w-full text-xs" onClick={() => { void loadKeys({ database: selectedDatabase, cursor: nextCursor, append: true }) }} loading={loadingKeys}>
                    加载更多
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-h-0 min-w-0 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col gap-4 pl-2">
            <div className="shrink-0 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">缓存工作台</div>
                  <div className="text-xs text-muted-foreground">结构化编辑适合键值维护，命令模式适合直接输入 Redis 指令</div>
                </div>
                <div className="inline-flex rounded-xl border border-border bg-background/70 p-1" role="tablist" aria-label="缓存工作模式">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'structured'}
                    disabled={mode === 'structured'}
                    onClick={() => setMode('structured')}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition ${mode === 'structured' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    结构化编辑
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'command'}
                    disabled={mode === 'command'}
                    onClick={() => setMode('command')}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition ${mode === 'command' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                  >
                    <TerminalSquare className="h-3.5 w-3.5" />
                    命令模式
                  </button>
                </div>
              </div>
            </div>

            <div className="shrink-0 rounded-2xl border border-border bg-card p-4 space-y-3">
              {mode === 'structured' ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {creatingKey ? '新建缓存键' : selectedKeyDetail ? selectedKeyDetail.key : '选择一个缓存键'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {creatingKey
                          ? `将在 db${selectedDatabase} 中创建新的缓存键`
                          : selectedKeyDetail
                            ? `${selectedKeyDetail.type.toUpperCase()} · TTL ${formatTTL(selectedKeyDetail.ttl_seconds)} · ${selectedKeyDetail.size} 项`
                            : '可对 string / hash / list / set / zset 做增删改查'}
                      </div>
                    </div>

                    {!creatingKey && selectedKeyDetail ? (
                      <Button size="sm" variant="destructive" onClick={handleDeleteKey} loading={deleting}>
                        <Trash2 className="h-3.5 w-3.5" />
                        删除键
                      </Button>
                    ) : null}
                  </div>

                  {creatingKey || selectedKeyDetail ? (
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_140px_140px]">
                      <Input value={draftKey} onChange={(event) => setDraftKey(event.target.value)} placeholder="例如 user:1001" disabled={!creatingKey} />
                      <Select value={draftType} onValueChange={(value) => handleDraftTypeChange(value as CacheValueType)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CACHE_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{type.toUpperCase()}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input value={draftTTL} onChange={(event) => setDraftTTL(event.target.value)} placeholder="TTL 秒数，留空永久" />
                    </div>
                  ) : null}

                  {loadingDetail ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
                      正在加载缓存键详情...
                    </div>
                  ) : creatingKey || selectedKeyDetail ? (
                    <>
                      {draftType === 'string' ? (
                        <Textarea
                          value={draftStringValue}
                          onChange={(event) => setDraftStringValue(event.target.value)}
                          className="min-h-[180px] font-mono text-xs"
                          placeholder="输入字符串内容"
                        />
                      ) : (
                        <div className="rounded-xl border border-border bg-background/40">
                          <div
                            className="grid gap-px border-b border-border bg-border text-[11px] font-medium text-muted-foreground"
                            style={{ gridTemplateColumns: draftType === 'hash' ? 'minmax(0,180px) minmax(0,1fr) 56px' : draftType === 'zset' ? 'minmax(0,1fr) 120px 56px' : 'minmax(0,1fr) 56px' }}
                          >
                            {draftType === 'hash' ? <div className="bg-card px-3 py-2">字段</div> : null}
                            <div className="bg-card px-3 py-2">{draftType === 'zset' ? '成员' : '值'}</div>
                            {draftType === 'zset' ? <div className="bg-card px-3 py-2">Score</div> : null}
                            <div className="bg-card px-3 py-2 text-center">操作</div>
                          </div>

                          <div className="max-h-[220px] space-y-px overflow-auto bg-border">
                            {draftEntries.map((entry, index) => (
                              <div
                                key={`entry-${index}`}
                                className="grid gap-px bg-border"
                                style={{ gridTemplateColumns: draftType === 'hash' ? 'minmax(0,180px) minmax(0,1fr) 56px' : draftType === 'zset' ? 'minmax(0,1fr) 120px 56px' : 'minmax(0,1fr) 56px' }}
                              >
                                {draftType === 'hash' ? (
                                  <Input value={entry.field ?? ''} onChange={(event) => updateEntry(index, { field: event.target.value })} className="rounded-none border-0 bg-card text-xs" placeholder="field" />
                                ) : null}
                                <Input value={entry.value ?? ''} onChange={(event) => updateEntry(index, { value: event.target.value })} className="rounded-none border-0 bg-card text-xs" placeholder="value" />
                                {draftType === 'zset' ? (
                                  <Input value={String(entry.score ?? 0)} onChange={(event) => updateEntry(index, { score: Number(event.target.value || 0) })} className="rounded-none border-0 bg-card text-xs" placeholder="0" />
                                ) : null}
                                <div className="flex items-center justify-center bg-card px-2">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removeEntry(index)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="border-t border-border bg-card px-3 py-2">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={addEntry}>
                              <Plus className="h-3.5 w-3.5" />
                              添加条目
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        {creatingKey ? (
                          <Button size="sm" variant="outline" onClick={() => setCreatingKey(false)}>
                            取消
                          </Button>
                        ) : null}
                        <Button size="sm" onClick={handleSaveKey} loading={saving}>
                          保存缓存键
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
                      从左侧选择一个缓存键，或创建新键后即可进行结构化编辑
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">Redis 命令模式</div>
                      <div className="text-xs text-muted-foreground">支持直接输入 Redis 指令，不再限制只读命令</div>
                    </div>
                    <Button size="sm" onClick={handleRunCommand} loading={runningCommand}>
                      <Play className="h-3.5 w-3.5" />
                      执行命令
                    </Button>
                  </div>

                  <Textarea
                    value={commandText}
                    onChange={(event) => setCommandText(event.target.value)}
                    className="min-h-[180px] font-mono text-xs"
                    placeholder="例如：GET user:1001 或 HSET user:1001 name alice"
                  />
                </>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              <ResultPanel result={lastResult} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
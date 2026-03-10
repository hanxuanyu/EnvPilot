import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  Database,
  Download,
  History,
  KeyRound,
  Play,
  RefreshCw,
  Search,
  Server,
  Star,
  TableProperties,
  Trash2,
  Wifi,
} from 'lucide-react'
import CodeMirror from '@uiw/react-codemirror'
import { sql as sqlLanguage, MySQL, PostgreSQL } from '@codemirror/lang-sql'
import { EditorView, keymap } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { connectorService } from '@/services/connectorService'
import { exportQueryResult } from '@/lib/queryExport'
import { useTheme } from '@/lib/theme'
import { getAssetAddress, type Asset, type Environment } from '@/types/asset'
import type { DatabaseCatalog, QueryResult, TableDetail } from '@/types/connector'
import { prettyValue } from '@/components/connector/utils'

interface SQLConnectorPanelProps {
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

interface SQLHistoryItem {
  id: string
  assetId: number
  assetName: string
  database: string
  sql: string
  executedAt: string
}

interface SQLFavoriteItem {
  id: string
  assetId: number
  assetName: string
  database: string
  label: string
  sql: string
  savedAt: string
}

type TableDetailMap = Record<string, TableDetail>

const HISTORY_STORAGE_KEY = 'envpilot:sql-history'
const FAVORITE_STORAGE_KEY = 'envpilot:sql-favorites'
const HISTORY_LIMIT = 20
const FAVORITE_LIMIT = 20

function isSystemDatabase(pluginType: string, databaseName: string) {
  const normalizedName = databaseName.trim().toLowerCase()
  if (!normalizedName) return false

  if (pluginType === 'mysql') {
    return ['information_schema', 'mysql', 'performance_schema', 'sys'].includes(normalizedName)
  }

  if (pluginType === 'postgresql') {
    return ['postgres', 'template0', 'template1'].includes(normalizedName)
  }

  return false
}

function isSystemTable(pluginType: string, tableName: string) {
  const normalizedName = tableName.trim().toLowerCase()
  if (!normalizedName) return false

  if (pluginType === 'postgresql') {
    return normalizedName.startsWith('pg_') || normalizedName.startsWith('sql_')
  }

  return false
}

function getStorageItems<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const rawValue = window.localStorage.getItem(key)
    if (!rawValue) return []
    const parsed = JSON.parse(rawValue) as unknown
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

function setStorageItems<T>(key: string, items: T[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(items))
}

function buildSQLLabel(sql: string) {
  const firstLine = sql
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) || '未命名 SQL'
  return firstLine.slice(0, 32)
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function summarizeResult(result: QueryResult) {
  if (result.columns.length > 0) {
    return `返回 ${result.rows.length} 行，耗时 ${result.duration_ms}ms`
  }
  return `${result.summary || 'SQL 执行成功'}，影响 ${result.affected} 行，耗时 ${result.duration_ms}ms`
}

function buildTableKey(databaseName: string, tableName: string) {
  return `${databaseName}.${tableName}`
}

function countNonPrimaryIndexes(detail: TableDetail) {
  return (detail.indexes ?? []).filter((item) => !item.primary).length
}

function summarizeTableNode(detail?: TableDetail) {
  if (!detail) return [] as string[]
  const summary = [`${detail.columns.length} 列`]
  const primaryCount = (detail.indexes ?? []).filter((item) => item.primary).length
  const secondaryCount = countNonPrimaryIndexes(detail)
  if (primaryCount > 0) summary.push(`PK ${primaryCount}`)
  if (secondaryCount > 0) summary.push(`IDX ${secondaryCount}`)
  return summary
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
            {selectedAsset?.name ?? '选择数据库资产'}
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
                没有匹配的数据库资产
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

function ResultTable({ result }: { result: QueryResult | null }) {
  if (!result) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
        在上方输入 SQL 脚本后，执行结果会以表格形式展示在这里
      </div>
    )
  }

  if (result.columns.length === 0) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/60">
              <th className="px-4 py-3 text-left font-medium text-foreground">指标</th>
              <th className="px-4 py-3 text-left font-medium text-foreground">结果</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <td className="px-4 py-3 text-muted-foreground">执行摘要</td>
              <td className="px-4 py-3 text-foreground">{result.summary || 'SQL 执行成功'}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="px-4 py-3 text-muted-foreground">影响行数</td>
              <td className="px-4 py-3 text-foreground">{result.affected}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="px-4 py-3 text-muted-foreground">耗时</td>
              <td className="px-4 py-3 text-foreground">{result.duration_ms}ms</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-2xl border border-border bg-card">
      <table className="min-w-[720px] text-sm">
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
                  <pre className="whitespace-pre-wrap break-all font-sans">{prettyValue(row[column.name])}</pre>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function copyText(text: string, label: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast.success(`已复制${label}`),
    () => toast.error(`复制${label}失败`),
  )
}

export function SQLConnectorPanel({ asset, assets, environments, selectedEnvId, onSelectEnv, onSelectAsset }: SQLConnectorPanelProps) {
  const { resolvedTheme } = useTheme()
  const [testing, setTesting] = useState(false)
  const [running, setRunning] = useState(false)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [loadingTableKeys, setLoadingTableKeys] = useState<string[]>([])
  const [exportingFormat, setExportingFormat] = useState<string | null>(null)
  const [database, setDatabase] = useState('')
  const [sql, setSQL] = useState('SELECT 1 AS ok;')
  const [sqlLimit, setSQLLimit] = useState('500')
  const [catalog, setCatalog] = useState<DatabaseCatalog | null>(null)
  const [result, setResult] = useState<QueryResult | null>(null)
  const [expandedDatabases, setExpandedDatabases] = useState<string[]>([])
  const [selectedTableKey, setSelectedTableKey] = useState('')
  const [tableDetails, setTableDetails] = useState<TableDetailMap>({})
  const [historyItems, setHistoryItems] = useState<SQLHistoryItem[]>(() => getStorageItems<SQLHistoryItem>(HISTORY_STORAGE_KEY))
  const [favoriteItems, setFavoriteItems] = useState<SQLFavoriteItem[]>(() => getStorageItems<SQLFavoriteItem>(FAVORITE_STORAGE_KEY))

  useEffect(() => {
    setDatabase((asset?.ext_config?.database as string | undefined) ?? '')
    setCatalog(null)
    setResult(null)
    setExpandedDatabases([])
    setSelectedTableKey('')
    setTableDetails({})
    setLoadingTableKeys([])
  }, [asset?.id])

  useEffect(() => {
    if (!asset) return

    let cancelled = false

    const loadCatalog = async () => {
      setLoadingCatalog(true)
      try {
        const nextCatalog = await connectorService.getDatabaseCatalog(asset.id)
        if (cancelled) return

        setCatalog(nextCatalog)
        const preferredDatabase =
          (asset.ext_config?.database as string | undefined)
          || nextCatalog.default_database
          || nextCatalog.databases[0]?.name
          || ''
        setDatabase(preferredDatabase)
        if (preferredDatabase) {
          setExpandedDatabases((current) => current.includes(preferredDatabase) ? current : [...current, preferredDatabase])
        }
      } catch (error: any) {
        if (cancelled) return
        setCatalog(null)
        toast.error('加载数据库目录失败', { description: error.message })
      } finally {
        if (!cancelled) setLoadingCatalog(false)
      }
    }

    void loadCatalog()

    return () => {
      cancelled = true
    }
  }, [asset])

  const visibleCatalog = useMemo(() => {
    if (!asset || !catalog) return null

    return {
      ...catalog,
      databases: catalog.databases
        .filter((item) => !isSystemDatabase(asset.plugin_type, item.name))
        .map((item) => ({
          ...item,
          tables: item.tables.filter((tableName) => !isSystemTable(asset.plugin_type, tableName)),
        })),
    }
  }, [asset, catalog])

  const selectedTableDetail = useMemo(
    () => tableDetails[selectedTableKey] ?? null,
    [selectedTableKey, tableDetails],
  )

  const completionSchema = useMemo(() => {
    const schemaEntries: Record<string, Record<string, string[]>> = {}
    Object.values(tableDetails).forEach((detail) => {
      const databaseName = detail.database || database || 'default'
      if (!schemaEntries[databaseName]) schemaEntries[databaseName] = {}
      schemaEntries[databaseName][detail.table] = detail.columns.map((column) => column.name)
    })
    return schemaEntries
  }, [database, tableDetails])

  const editorExtensions = useMemo(() => {
    const dialect = asset?.plugin_type === 'postgresql' ? PostgreSQL : MySQL
    return [
      sqlLanguage({ dialect, upperCaseKeywords: true, schema: completionSchema as never }),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': {
          minHeight: '220px',
          maxHeight: '220px',
          fontSize: '13px',
          backgroundColor: 'transparent',
          color: resolvedTheme === 'dark' ? '#e5e7eb' : '#111827',
        },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
        },
        '.cm-content': {
          padding: '10px 0',
        },
        '.cm-gutters': {
          backgroundColor: resolvedTheme === 'dark' ? '#0f172acc' : '#f8fafccc',
          color: resolvedTheme === 'dark' ? '#94a3b8' : '#64748b',
          borderRight: resolvedTheme === 'dark' ? '1px solid rgba(148, 163, 184, 0.16)' : '1px solid rgba(148, 163, 184, 0.2)',
        },
        '.cm-activeLine, .cm-activeLineGutter': {
          backgroundColor: resolvedTheme === 'dark' ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.10)',
        },
        '.cm-selectionBackground, .cm-content ::selection': {
          backgroundColor: resolvedTheme === 'dark' ? 'rgba(56, 189, 248, 0.22)' : 'rgba(14, 165, 233, 0.18)',
        },
        '.cm-tooltip': {
          border: resolvedTheme === 'dark' ? '1px solid rgba(148, 163, 184, 0.18)' : '1px solid rgba(148, 163, 184, 0.25)',
          backgroundColor: resolvedTheme === 'dark' ? '#0f172a' : '#ffffff',
          color: resolvedTheme === 'dark' ? '#e5e7eb' : '#0f172a',
        },
        '.cm-panels': {
          backgroundColor: resolvedTheme === 'dark' ? '#0f172a' : '#ffffff',
        },
      }),
      keymap.of([{
        key: 'Mod-Enter',
        run: () => {
          void handleExecuteSQL()
          return true
        },
      }]),
    ]
  }, [asset?.plugin_type, completionSchema, resolvedTheme])

  const editorTheme = useMemo(() => (resolvedTheme === 'dark' ? oneDark : 'light'), [resolvedTheme])

  const assetHistoryItems = useMemo(
    () => asset ? historyItems.filter((item) => item.assetId === asset.id).slice(0, 8) : [],
    [asset, historyItems],
  )

  const assetFavoriteItems = useMemo(
    () => asset ? favoriteItems.filter((item) => item.assetId === asset.id).slice(0, 8) : [],
    [asset, favoriteItems],
  )

  const persistHistory = (nextItems: SQLHistoryItem[]) => {
    setHistoryItems(nextItems)
    setStorageItems(HISTORY_STORAGE_KEY, nextItems)
  }

  const persistFavorites = (nextItems: SQLFavoriteItem[]) => {
    setFavoriteItems(nextItems)
    setStorageItems(FAVORITE_STORAGE_KEY, nextItems)
  }

  const toggleDatabase = (databaseName: string) => {
    setExpandedDatabases((current) => current.includes(databaseName)
      ? current.filter((item) => item !== databaseName)
      : [...current, databaseName])
  }

  const loadTableDetail = async (databaseName: string, tableName: string, options?: { silent?: boolean }) => {
    if (!asset) return
    const tableKey = buildTableKey(databaseName, tableName)
    if (tableDetails[tableKey]) {
      if (!options?.silent) {
        setDatabase(databaseName)
        setSelectedTableKey(tableKey)
      }
      return
    }

    setLoadingTableKeys((current) => current.includes(tableKey) ? current : [...current, tableKey])
    if (!options?.silent) {
      setSelectedTableKey(tableKey)
      setDatabase(databaseName)
    }
    try {
      const detail = await connectorService.getTableDetail({
        asset_id: asset.id,
        database: databaseName,
        table: tableName,
      })
      setTableDetails((current) => ({ ...current, [tableKey]: detail }))
    } catch (error: any) {
      if (!options?.silent) {
        toast.error('加载表详情失败', { description: error.message })
      }
    } finally {
      setLoadingTableKeys((current) => current.filter((item) => item !== tableKey))
    }
  }

  const insertTableTemplate = () => {
    if (!selectedTableDetail) return
    setDatabase(selectedTableDetail.database || database)
    setSQL(`SELECT *\nFROM ${selectedTableDetail.table}\nLIMIT ${Number(sqlLimit) || 500};`)
  }

  const saveCurrentFavorite = () => {
    if (!asset) return
    const trimmedSQL = sql.trim()
    if (!trimmedSQL) {
      toast.error('当前 SQL 为空，无法收藏')
      return
    }

    const nextItem: SQLFavoriteItem = {
      id: `${asset.id}-${Date.now()}`,
      assetId: asset.id,
      assetName: asset.name,
      database: database.trim(),
      label: buildSQLLabel(trimmedSQL),
      sql: trimmedSQL,
      savedAt: new Date().toISOString(),
    }

    const deduped = favoriteItems.filter((item) => !(item.assetId === nextItem.assetId && item.database === nextItem.database && item.sql === nextItem.sql))
    persistFavorites([nextItem, ...deduped].slice(0, FAVORITE_LIMIT))
    toast.success('已加入收藏', { description: nextItem.label })
  }

  const removeFavorite = (favoriteId: string) => {
    persistFavorites(favoriteItems.filter((item) => item.id !== favoriteId))
    toast.success('已移除收藏')
  }

  const applyFavorite = (item: SQLFavoriteItem) => {
    setDatabase(item.database)
    setSQL(item.sql)
    toast.success('已载入收藏语句', { description: item.label })
  }

  if (!asset) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
        当前环境下没有可用的数据库资产，请先选择环境或创建 MySQL / PostgreSQL 资产。
      </div>
    )
  }

  const handleTestConnection = async () => {
    setTesting(true)
    try {
      await connectorService.testConnection(asset.id)
      toast.success('连接测试成功', { description: `${asset.name} 连接正常` })
    } catch (error: any) {
      toast.error('连接测试失败', { description: error.message })
    } finally {
      setTesting(false)
    }
  }

  const handleReloadCatalog = async () => {
    setLoadingCatalog(true)
    try {
      const nextCatalog = await connectorService.getDatabaseCatalog(asset.id)
      setCatalog(nextCatalog)
      if (!database && nextCatalog.databases.length > 0) {
        setDatabase(nextCatalog.default_database || nextCatalog.databases[0].name)
      }
      toast.success('数据库目录已刷新')
    } catch (error: any) {
      toast.error('刷新数据库目录失败', { description: error.message })
    } finally {
      setLoadingCatalog(false)
    }
  }

  const handleExecuteSQL = async () => {
    const trimmedSQL = sql.trim()
    if (!trimmedSQL) {
      toast.error('SQL 不能为空')
      return
    }

    setRunning(true)
    try {
      const next = await connectorService.executeSQL({
        asset_id: asset.id,
        database,
        query: trimmedSQL,
        limit: Number(sqlLimit) || 500,
      })
      setResult(next)

      const nextHistoryItem: SQLHistoryItem = {
        id: `${asset.id}-${Date.now()}`,
        assetId: asset.id,
        assetName: asset.name,
        database: database.trim(),
        sql: trimmedSQL,
        executedAt: new Date().toISOString(),
      }
      const deduped = historyItems.filter((item) => !(item.assetId === nextHistoryItem.assetId && item.database === nextHistoryItem.database && item.sql === nextHistoryItem.sql))
      persistHistory([nextHistoryItem, ...deduped].slice(0, HISTORY_LIMIT))

      toast.success('SQL 执行成功', { description: summarizeResult(next) })
    } catch (error: any) {
      toast.error('SQL 执行失败', { description: error.message })
    } finally {
      setRunning(false)
    }
  }

  const handleExportResult = async (format: 'csv' | 'json' | 'xlsx') => {
    if (!result) {
      toast.error('当前没有可导出的结果')
      return
    }

    setExportingFormat(format)
    try {
      const savedPath = await exportQueryResult(result, `${asset.name}-${database || 'default'}-result`, format)
      toast.success('结果导出成功', { description: savedPath || `已导出为 ${format.toUpperCase()} 文件` })
    } catch (error: any) {
      toast.error('结果导出失败', { description: error.message })
    } finally {
      setExportingFormat(null)
    }
  }

  const renderCreateSQLTooltip = (detail?: TableDetail) => {
    if (!detail) {
      return <div className="text-[11px] text-muted-foreground">悬浮后自动加载建表语句</div>
    }

    return (
      <div className="w-[440px] max-w-[70vw] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-foreground">{detail.table}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {(detail.database || '当前数据库')}{detail.schema ? ` · ${detail.schema}` : ''} · {detail.columns.length} 列
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => copyText(detail.create_sql || '', '建表语句')} disabled={!detail.create_sql}>
            <Copy className="h-3.5 w-3.5" />
            复制 DDL
          </Button>
        </div>

        <div className="max-h-44 overflow-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-[11px] leading-5 text-foreground">
          <pre className="whitespace-pre-wrap break-all">{detail.create_sql || '-- 当前连接器未返回建表语句 --'}</pre>
        </div>

        {(detail.indexes ?? []).length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-medium text-foreground">索引概览</div>
            <div className="space-y-1">
              {(detail.indexes ?? []).map((item) => (
                <div key={item.name} className="rounded-md border border-border/70 bg-background/40 px-2.5 py-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="font-medium">{item.name}</span>
                    {item.primary ? <Badge variant="outline">PRIMARY</Badge> : item.unique ? <Badge variant="outline">UNIQUE</Badge> : <Badge variant="outline">INDEX</Badge>}
                    {item.method && <span>{item.method}</span>}
                  </div>
                  {item.columns?.length ? <div className="mt-1">{item.columns.join(', ')}</div> : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={520}>
      <div className="space-y-4 min-w-0">
        <div className="rounded-2xl border border-border bg-card px-3 py-3">
          <div className="grid gap-2 xl:grid-cols-[180px_minmax(260px,420px)_minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <Select
              value={selectedEnvId?.toString() ?? '__all__'}
              onValueChange={async (value) => {
                await onSelectEnv(value === '__all__' ? null : Number(value))
              }}
            >
              <SelectTrigger className="h-9 rounded-lg">
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

          <SearchableAssetSelect assets={assets} selectedAsset={asset} onSelect={onSelectAsset} />

          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground xl:justify-end">
            <Badge variant="outline">{asset.plugin_type}</Badge>
            <span>{getAssetAddress(asset)}</span>
            {visibleCatalog?.schema && <span>Schema: {visibleCatalog.schema}</span>}
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button variant="outline" size="sm" onClick={handleTestConnection} loading={testing} className="h-9 rounded-lg px-3">
              <Wifi className="h-4 w-4" />
              测试
            </Button>
            <Button variant="outline" size="sm" onClick={handleReloadCatalog} loading={loadingCatalog} className="h-9 rounded-lg px-3">
              <RefreshCw className="h-4 w-4" />
              刷新目录
            </Button>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4 min-w-0">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Server className="h-4 w-4 text-primary" />
                数据库目录
              </div>
              <Badge variant="outline">{visibleCatalog?.databases.length ?? 0} DB</Badge>
            </div>

            <div className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto pr-1">
              {loadingCatalog ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  正在加载数据库目录...
                </div>
              ) : !visibleCatalog || visibleCatalog.databases.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  当前资产没有可展示的数据库目录
                </div>
              ) : visibleCatalog.databases.map((item) => {
                const expanded = expandedDatabases.includes(item.name)
                const selected = item.name === database
                return (
                  <div key={item.name} className="rounded-xl border border-border/80 bg-background/40">
                    <button
                      type="button"
                      onClick={() => {
                        setDatabase(item.name)
                        toggleDatabase(item.name)
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left ${selected ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                        <Database className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate text-sm font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.error ? (
                          <Badge variant="outline" className="border-red-500/40 text-red-300">目录异常</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{item.tables.length} 表</span>
                        )}
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t border-border/70 px-3 py-3">
                        {item.error ? (
                          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-xs text-red-200">
                            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{item.error}</span>
                          </div>
                        ) : item.tables.length === 0 ? (
                          <div className="text-xs text-muted-foreground">当前数据库没有可见数据表</div>
                        ) : (
                          <div className="space-y-1">
                            {item.tables.map((tableName) => {
                              const tableKey = buildTableKey(item.name, tableName)
                              const activeTable = selectedTableKey === tableKey
                              const detail = tableDetails[tableKey]
                              const isTableLoading = loadingTableKeys.includes(tableKey)
                              const nodeSummary = summarizeTableNode(detail)
                              return (
                                <Tooltip key={tableName}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onMouseEnter={() => { void loadTableDetail(item.name, tableName, { silent: true }) }}
                                      onFocus={() => { void loadTableDetail(item.name, tableName, { silent: true }) }}
                                      onClick={() => { void loadTableDetail(item.name, tableName) }}
                                      className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${activeTable ? 'border-primary/30 bg-primary/8 text-foreground' : 'border-transparent text-muted-foreground hover:border-primary/20 hover:bg-accent/50 hover:text-foreground'}`}
                                    >
                                      <div className="flex items-start gap-2">
                                        <TableProperties className="mt-0.5 h-4 w-4 shrink-0" />
                                        <div className="min-w-0 flex-1 space-y-1">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="truncate text-sm font-medium">{tableName}</span>
                                            {isTableLoading ? <span className="text-[10px] text-muted-foreground">加载中...</span> : null}
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {nodeSummary.map((text) => <Badge key={text} variant="outline" className="px-1.5 py-0 text-[10px]">{text}</Badge>)}
                                            {detail?.indexes?.some((index) => index.primary) ? (
                                              <Badge variant="outline" className="px-1.5 py-0 text-[10px]"><KeyRound className="mr-1 h-3 w-3" />主键</Badge>
                                            ) : null}
                                          </div>
                                          {detail ? (
                                            <div className="truncate text-[11px] text-muted-foreground">
                                              {(detail.indexes ?? []).slice(0, 2).map((index) => index.name).join(' · ') || '悬浮查看 DDL'}
                                            </div>
                                          ) : (
                                            <div className="text-[11px] text-muted-foreground">悬浮查看 DDL 与索引</div>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-none p-3">
                                    {renderCreateSQLTooltip(detail)}
                                  </TooltipContent>
                                </Tooltip>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm font-medium text-foreground">
                <span>执行上下文</span>
                {selectedTableDetail ? <Badge variant="outline">{selectedTableDetail.table}</Badge> : null}
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] text-muted-foreground">数据库</div>
                <Input value={database} onChange={(event) => setDatabase(event.target.value)} placeholder="输入或选择数据库名" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] text-muted-foreground">结果上限</div>
                <Input value={sqlLimit} onChange={(event) => setSQLLimit(event.target.value)} placeholder="500" inputMode="numeric" className="h-9" />
              </div>
              {selectedTableDetail ? (
                <Button variant="outline" size="sm" onClick={insertTableTemplate} className="h-9 w-full">
                  插入查询模板
                </Button>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-background/50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <History className="h-4 w-4 text-primary" />
                执行历史
              </div>
              <div className="max-h-32 space-y-2 overflow-auto pr-1">
                {assetHistoryItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground">当前资产还没有执行历史</div>
                ) : assetHistoryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setDatabase(item.database)
                      setSQL(item.sql)
                      toast.success('已载入历史语句', { description: buildSQLLabel(item.sql) })
                    }}
                    className="w-full rounded-lg border border-border px-3 py-2 text-left transition hover:border-primary/30 hover:bg-accent/40"
                  >
                    <div className="truncate text-sm font-medium text-foreground">{buildSQLLabel(item.sql)}</div>
                    <div className="truncate text-xs text-muted-foreground">{item.database || '默认库'} · {formatTimestamp(item.executedAt)}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background/50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Star className="h-4 w-4 text-primary" />
                  收藏语句
                </div>
                <Button variant="outline" size="sm" onClick={saveCurrentFavorite} className="h-8">
                  <Star className="h-3.5 w-3.5" />
                  收藏当前
                </Button>
              </div>
              <div className="max-h-32 space-y-2 overflow-auto pr-1">
                {assetFavoriteItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground">当前资产还没有收藏语句</div>
                ) : assetFavoriteItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => applyFavorite(item)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="truncate text-sm font-medium text-foreground">{item.label}</div>
                        <div className="truncate text-xs text-muted-foreground">{item.database || '默认库'} · {formatTimestamp(item.savedAt)}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFavorite(item.id)}
                        className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                        aria-label="删除收藏"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="w-full min-w-0 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">SQL 脚本</div>
                <div className="text-xs text-muted-foreground">支持语法高亮、关键字与已加载表结构补全，⌘/Ctrl + Enter 可执行</div>
              </div>
              <Button size="sm" onClick={handleExecuteSQL} loading={running} className="h-9 shrink-0">
                <Play className="h-4 w-4" />
                执行 SQL
              </Button>
            </div>

            <div className="space-y-2">
              <div className="overflow-hidden rounded-xl border border-border bg-background/60 shadow-sm">
                <CodeMirror
                  value={sql}
                  height="220px"
                  theme={editorTheme}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: false,
                    dropCursor: false,
                    allowMultipleSelections: false,
                    highlightActiveLineGutter: true,
                  }}
                  extensions={editorExtensions}
                  onChange={(value) => setSQL(value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <div className="text-sm text-muted-foreground">
                {result ? summarizeResult(result) : '查询结果'}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => { void handleExportResult('csv') }} disabled={!result || !!exportingFormat}>
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
                <Button variant="outline" onClick={() => { void handleExportResult('json') }} disabled={!result || !!exportingFormat}>
                  <Download className="h-4 w-4" />
                  JSON
                </Button>
                <Button variant="outline" onClick={() => { void handleExportResult('xlsx') }} disabled={!result || !!exportingFormat} loading={exportingFormat === 'xlsx'}>
                  <Download className="h-4 w-4" />
                  Excel
                </Button>
              </div>
            </div>
            <ResultTable result={result} />
          </div>
        </div>
      </div>
      </div>
    </TooltipProvider>
  )
}
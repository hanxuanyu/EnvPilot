import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Database, Play, TableProperties, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { connectorService } from '@/services/connectorService'
import type { Asset } from '@/types/asset'
import type { QueryResult } from '@/types/connector'
import { prettyValue } from '@/components/connector/utils'

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
                    <pre className="whitespace-pre-wrap break-all font-sans">{prettyValue(row[column.name])}</pre>
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

export function SQLConnectorPanel({ asset }: { asset: Asset }) {
  const [testing, setTesting] = useState(false)
  const [running, setRunning] = useState(false)
  const [loadingDatabases, setLoadingDatabases] = useState(false)
  const [loadingTables, setLoadingTables] = useState(false)
  const [database, setDatabase] = useState('')
  const [sql, setSQL] = useState('SELECT 1 AS ok')
  const [sqlLimit, setSQLLimit] = useState('200')
  const [databases, setDatabases] = useState<string[]>([])
  const [tables, setTables] = useState<string[]>([])
  const [result, setResult] = useState<QueryResult | null>(null)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    setDatabase((asset.ext_config?.database as string | undefined) ?? '')
    setDatabases([])
    setTables([])
    setResult(null)
    setStatus(null)
  }, [asset.id])

  const handleTestConnection = async () => {
    setTesting(true)
    try {
      await connectorService.testConnection(asset.id)
      setStatus({ type: 'success', message: '连接测试成功' })
      toast.success(`${asset.name} 连接正常`)
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || '连接测试失败' })
      toast.error('连接测试失败', { description: error.message })
    } finally {
      setTesting(false)
    }
  }

  const handleLoadDatabases = async () => {
    setLoadingDatabases(true)
    try {
      const list = await connectorService.listDatabases(asset.id)
      setDatabases(list)
      if (!database && list.length > 0) setDatabase(list[0])
    } catch (error: any) {
      toast.error('加载数据库列表失败', { description: error.message })
    } finally {
      setLoadingDatabases(false)
    }
  }

  const handleLoadTables = async () => {
    setLoadingTables(true)
    try {
      const list = await connectorService.listTables(asset.id, database)
      setTables(list)
    } catch (error: any) {
      toast.error('加载数据表失败', { description: error.message })
    } finally {
      setLoadingTables(false)
    }
  }

  const handleExecuteSQL = async () => {
    setRunning(true)
    try {
      const next = await connectorService.executeSQL({
        asset_id: asset.id,
        database,
        query: sql,
        limit: Number(sqlLimit) || 200,
      })
      setResult(next)
      setStatus({ type: 'success', message: 'SQL 执行成功' })
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || 'SQL 执行失败' })
      toast.error('SQL 执行失败', { description: error.message })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4 min-w-0">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">{asset.name}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">{asset.plugin_type}</Badge>
              {asset.environment?.name && <span>{asset.environment.name}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleTestConnection} loading={testing}>
              <Wifi className="h-4 w-4" />
              测试连接
            </Button>
            <Button variant="outline" onClick={handleLoadDatabases} loading={loadingDatabases}>
              <Database className="h-4 w-4" />
              加载数据库
            </Button>
            <Button variant="outline" onClick={handleLoadTables} loading={loadingTables}>
              <TableProperties className="h-4 w-4" />
              加载数据表
            </Button>
          </div>
        </div>

        {status && (
          <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            status.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}>
            {status.message}
          </div>
        )}
      </div>

      <div className="grid gap-4 2xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="text-sm font-medium text-foreground">连接上下文</div>
            <Input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="数据库名，可留空" />
            <Input value={sqlLimit} onChange={(e) => setSQLLimit(e.target.value)} placeholder="结果行数限制" inputMode="numeric" />
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="text-sm font-medium text-foreground">数据库列表</div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {databases.length === 0 ? <div className="text-sm text-muted-foreground">点击“加载数据库”获取</div> : databases.map((item) => (
                <button
                  key={item}
                  onClick={() => setDatabase(item)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${database === item ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground'}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="text-sm font-medium text-foreground">数据表列表</div>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {tables.length === 0 ? <div className="text-sm text-muted-foreground">点击“加载数据表”获取</div> : tables.map((item) => (
                <div key={item} className="rounded-md border border-border px-3 py-2 text-sm text-foreground">{item}</div>
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
            <Textarea value={sql} onChange={(e) => setSQL(e.target.value)} className="min-h-[180px] font-mono text-sm" />
          </div>
          <ResultTable result={result} />
        </div>
      </div>
    </div>
  )
}
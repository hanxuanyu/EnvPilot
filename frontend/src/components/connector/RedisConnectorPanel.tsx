import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Play, TerminalSquare, Wifi, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { connectorService } from '@/services/connectorService'
import type { Asset } from '@/types/asset'
import type { CommandResult } from '@/types/connector'
import { prettyValue } from '@/components/connector/utils'

export function RedisConnectorPanel({ asset }: { asset: Asset }) {
  const [testing, setTesting] = useState(false)
  const [running, setRunning] = useState(false)
  const [command, setCommand] = useState('GET')
  const [argsText, setArgsText] = useState('sample:key')
  const [result, setResult] = useState<CommandResult | null>(null)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    setCommand('GET')
    setArgsText('sample:key')
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

  const handleRun = async () => {
    setRunning(true)
    try {
      const next = await connectorService.executeRedisCmd({
        asset_id: asset.id,
        command,
        args: argsText.split(/\s+/).filter(Boolean),
      })
      setResult(next)
      setStatus({ type: 'success', message: 'Redis 命令执行成功' })
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || 'Redis 命令执行失败' })
      toast.error('Redis 命令执行失败', { description: error.message })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">{asset.name}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Redis</Badge>
              {asset.environment?.name && <span>{asset.environment.name}</span>}
            </div>
          </div>
          <Button variant="outline" onClick={handleTestConnection} loading={testing}>
            <Wifi className="h-4 w-4" />
            测试连接
          </Button>
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

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <TerminalSquare className="h-4 w-4" />
              Redis 命令
            </div>
            <div className="text-xs text-muted-foreground">仅开放只读命令，参数按空格分隔</div>
          </div>
          <Button onClick={handleRun} loading={running}>
            <Play className="h-4 w-4" />
            执行命令
          </Button>
        </div>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          <Input value={command} onChange={(e) => setCommand(e.target.value.toUpperCase())} placeholder="GET" />
          <Input value={argsText} onChange={(e) => setArgsText(e.target.value)} placeholder="key 或多参数，使用空格分隔" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 text-sm font-medium text-foreground">命令结果</div>
        {result ? (
          <pre className="max-h-[520px] overflow-auto rounded-lg bg-secondary/40 p-4 text-sm text-foreground whitespace-pre-wrap break-all">
            {prettyValue(result.result)}
          </pre>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
            执行 Redis 命令后将在这里显示结果
          </div>
        )}
      </div>
    </div>
  )
}
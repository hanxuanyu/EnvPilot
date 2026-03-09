import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Play, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { connectorService } from '@/services/connectorService'
import type { Asset } from '@/types/asset'
import type { SendResult } from '@/types/connector'
import { parseHeaders, prettyValue } from '@/components/connector/utils'

interface HistoryItem {
  exchange: string
  routingKey: string
  body: string
  result: SendResult
  createdAt: string
}

export function RabbitMQConnectorPanel({ asset }: { asset: Asset }) {
  const [testing, setTesting] = useState(false)
  const [sending, setSending] = useState(false)
  const [exchange, setExchange] = useState('')
  const [routingKey, setRoutingKey] = useState('demo.queue')
  const [body, setBody] = useState('{\n  "message": "hello rabbitmq"\n}')
  const [headersText, setHeadersText] = useState('{}')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])

  useEffect(() => {
    setExchange('')
    setRoutingKey('demo.queue')
    setBody('{\n  "message": "hello rabbitmq"\n}')
    setHeadersText('{}')
    setStatus(null)
    setHistory([])
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

  const handleSend = async () => {
    setSending(true)
    try {
      const result = await connectorService.sendMQMessage({
        asset_id: asset.id,
        message: {
          exchange,
          routing_key: routingKey,
          body,
          headers: parseHeaders(headersText),
        },
      })
      setHistory(prev => [{ exchange, routingKey, body, result, createdAt: new Date().toLocaleString('zh-CN') }, ...prev].slice(0, 10))
      setStatus({ type: 'success', message: 'RabbitMQ 消息发送成功' })
      toast.success('RabbitMQ 消息发送成功')
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || 'RabbitMQ 消息发送失败' })
      toast.error('RabbitMQ 消息发送失败', { description: error.message })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{asset.name}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">RabbitMQ</Badge>
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">发送消息</div>
              <div className="text-xs text-muted-foreground">默认 exchange 为空时会发送到默认交换机</div>
            </div>
            <Button onClick={handleSend} loading={sending}>
              <Play className="h-4 w-4" />
              发送消息
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input value={exchange} onChange={(e) => setExchange(e.target.value)} placeholder="exchange，可留空" />
            <Input value={routingKey} onChange={(e) => setRoutingKey(e.target.value)} placeholder="routing key / queue" />
          </div>
          <Textarea value={headersText} onChange={(e) => setHeadersText(e.target.value)} className="min-h-[110px] font-mono text-sm" placeholder='{"trace_id":"demo"}' />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[220px] font-mono text-sm" placeholder="消息体" />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-medium text-foreground">发送历史</div>
          <div className="space-y-3 max-h-[640px] overflow-auto">
            {history.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">尚无发送记录</div>
            ) : history.map((item, index) => (
              <div key={`${item.createdAt}-${index}`} className="rounded-lg border border-border p-3 space-y-2">
                <div className="text-xs text-muted-foreground">{item.createdAt}</div>
                <div className="text-sm text-foreground">exchange: {item.exchange || '(default)'}</div>
                <div className="text-sm text-foreground">routing key: {item.routingKey}</div>
                <pre className="rounded bg-secondary/40 p-2 text-xs whitespace-pre-wrap break-all">{prettyValue(item.result)}</pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
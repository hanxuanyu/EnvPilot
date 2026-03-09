import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Play, Send, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { connectorService } from '@/services/connectorService'
import type { Asset } from '@/types/asset'
import type { SendResult } from '@/types/connector'
import { parseHeaders, prettyValue } from '@/components/connector/utils'

interface HistoryItem {
  topic: string
  tag: string
  key: string
  result: SendResult
  createdAt: string
}

export function RocketMQConnectorPanel({ asset }: { asset: Asset }) {
  const [testing, setTesting] = useState(false)
  const [sending, setSending] = useState(false)
  const [topic, setTopic] = useState('demo-topic')
  const [tag, setTag] = useState('TagA')
  const [key, setKey] = useState('')
  const [headersText, setHeadersText] = useState('{}')
  const [body, setBody] = useState('{\n  "message": "hello rocketmq"\n}')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])

  useEffect(() => {
    setTopic('demo-topic')
    setTag('TagA')
    setKey('')
    setHeadersText('{}')
    setBody('{\n  "message": "hello rocketmq"\n}')
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
          topic,
          tag,
          key,
          body,
          headers: parseHeaders(headersText),
        },
      })
      setHistory(prev => [{ topic, tag, key, result, createdAt: new Date().toLocaleString('zh-CN') }, ...prev].slice(0, 10))
      setStatus({ type: 'success', message: 'RocketMQ 消息发送成功' })
      toast.success('RocketMQ 消息发送成功')
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || 'RocketMQ 消息发送失败' })
      toast.error('RocketMQ 消息发送失败', { description: error.message })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">{asset.name}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">RocketMQ</Badge>
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

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(320px,1.15fr)_minmax(280px,0.85fr)] 2xl:grid-cols-[minmax(360px,1.2fr)_minmax(320px,0.8fr)]">
        <div className="w-full min-w-0 rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">发送消息</div>
              <div className="text-xs text-muted-foreground">支持 topic、tag、key 和自定义属性</div>
            </div>
            <Button onClick={handleSend} loading={sending}>
              <Play className="h-4 w-4" />
              发送消息
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="topic" />
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="tag，可留空" />
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key，可留空" />
          </div>
          <Textarea value={headersText} onChange={(e) => setHeadersText(e.target.value)} className="min-h-[110px] font-mono text-sm" placeholder='{"trace_id":"demo"}' />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[220px] font-mono text-sm" />
        </div>

        <div className="w-full min-w-0 rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="text-sm font-medium text-foreground">发送历史</div>
          <div className="space-y-3 max-h-[640px] overflow-auto">
            {history.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">尚无发送记录</div>
            ) : history.map((item, index) => (
              <div key={`${item.createdAt}-${index}`} className="rounded-lg border border-border p-3 space-y-2">
                <div className="text-xs text-muted-foreground">{item.createdAt}</div>
                <div className="text-sm text-foreground">topic: {item.topic}</div>
                {item.tag && <div className="text-sm text-foreground">tag: {item.tag}</div>}
                {item.key && <div className="text-sm text-foreground">key: {item.key}</div>}
                <pre className="rounded bg-secondary/40 p-2 text-xs whitespace-pre-wrap break-all">{prettyValue(item.result)}</pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
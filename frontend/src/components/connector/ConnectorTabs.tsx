import { Database, Send, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConnectorTabKey } from '@/types/connector'

const tabs: Array<{ key: ConnectorTabKey; label: string; icon: typeof Database }> = [
  { key: 'database', label: '数据库', icon: Database },
  { key: 'cache', label: '缓存', icon: Zap },
  { key: 'mq', label: '消息队列', icon: Send },
]

export function ConnectorTabs({
  active,
  counts,
  onChange,
}: {
  active: ConnectorTabKey
  counts: Record<ConnectorTabKey, number>
  onChange: (tab: ConnectorTabKey) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2">
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors',
              active === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-xs',
              active === tab.key ? 'bg-black/15 text-current' : 'bg-secondary text-muted-foreground',
            )}
            >
              {counts[tab.key] ?? 0}
            </span>
          </button>
        )
      })}
    </div>
  )
}
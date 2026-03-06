// StatusBadge.tsx — 资产状态标签，使用统一 Badge 组件
import { Badge } from '@/components/ui/badge'
import type { AssetStatus } from '@/types/asset'

const STATUS_BADGE_VARIANT: Record<AssetStatus, 'success' | 'destructive' | 'warning' | 'secondary'> = {
  online:   'success',
  offline:  'destructive',
  warning:  'warning',
  unknown:  'secondary',
}

const STATUS_DOT_COLOR: Record<AssetStatus, string> = {
  online:  '#22c55e',
  offline: '#ef4444',
  warning: '#f59e0b',
  unknown: '#6b7280',
}

const STATUS_LABELS: Record<AssetStatus, string> = {
  online:  '在线',
  offline: '离线',
  warning: '告警',
  unknown: '未检测',
}

export function StatusBadge({ status }: { status: AssetStatus }) {
  return (
    <Badge variant={STATUS_BADGE_VARIANT[status]}>
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: STATUS_DOT_COLOR[status] }}
      />
      {STATUS_LABELS[status]}
    </Badge>
  )
}

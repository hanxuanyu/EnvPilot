// StatusBadge.tsx 资产状态标签组件
import type { AssetStatus } from '@/types/asset'
import { ASSET_STATUS_LABELS, ASSET_STATUS_COLORS } from '@/types/asset'

interface StatusBadgeProps {
  status: AssetStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = ASSET_STATUS_COLORS[status]
  const label = ASSET_STATUS_LABELS[status]

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: color + '20',
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  )
}

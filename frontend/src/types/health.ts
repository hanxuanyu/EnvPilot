import type { Asset, AssetCategory } from '@/types/asset'

export type HealthStatus = 'unknown' | 'healthy' | 'warning' | 'critical' | 'unreachable'

export interface HealthSnapshot {
  id: number
  asset_id: number
  environment_id: number
  status: HealthStatus
  check_type: string
  latency_ms: number
  detail: string
  metrics: Record<string, unknown>
  checked_at: string
  created_at: string
  asset?: Asset
}

export interface ListHealthSnapshotsReq {
  environment_id?: number
  category?: AssetCategory | ''
  status?: HealthStatus | ''
  keyword?: string
  limit?: number
  offset?: number
}

export interface ListHealthSnapshotsResult {
  items: HealthSnapshot[]
  total: number
}

export interface HealthSummary {
  total: number
  healthy: number
  warning: number
  critical: number
  unreachable: number
  unknown: number
}

export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
  unknown: '未知',
  healthy: '健康',
  warning: '告警',
  critical: '严重',
  unreachable: '不可达',
}
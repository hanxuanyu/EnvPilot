import { IS_SERVER_MODE, http, unwrapResult } from '@/lib/apiClient'
import type {
  HealthSnapshot,
  HealthSummary,
  ListHealthSnapshotsReq,
  ListHealthSnapshotsResult,
} from '@/types/health'

function getDesktopAPI() {
  const api = (window as any).go?.healthapi?.HealthAPI
  if (!api) throw new Error('HealthAPI 未绑定')
  return api
}

export const healthService = {
  listSnapshots: async (req: ListHealthSnapshotsReq = {}) => {
    if (IS_SERVER_MODE) return http.get<ListHealthSnapshotsResult>('/api/health/snapshots', req as any)
    const result = await getDesktopAPI().ListSnapshots(req)
    return unwrapResult(result as any) as ListHealthSnapshotsResult
  },
  getSummary: async (req: ListHealthSnapshotsReq = {}) => {
    if (IS_SERVER_MODE) return http.get<HealthSummary>('/api/health/summary', req as any)
    const result = await getDesktopAPI().GetSummary(req)
    return unwrapResult(result as any) as HealthSummary
  },
  checkAsset: async (assetId: number) => {
    if (IS_SERVER_MODE) return http.post<HealthSnapshot>(`/api/health/check/${assetId}`)
    const result = await getDesktopAPI().CheckAsset(assetId)
    return unwrapResult(result as any) as HealthSnapshot
  },
  checkAll: async (req: { environment_id?: number; category?: string }) => {
    if (IS_SERVER_MODE) return http.post<{ checked: number }>('/api/health/check-all', req)
    const result = await getDesktopAPI().CheckAll(req)
    return unwrapResult(result as any) as { checked: number }
  },
}
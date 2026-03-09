import { IS_SERVER_MODE, http, unwrapResult } from '@/lib/apiClient'
import type {
  AppConfig,
  ConfigSnapshotDetailResult,
  ConfigSnapshotListResult,
  CurrentConfigResult,
} from '@/types/config'

function getDesktopAPI() {
  const api = (window as any).go?.configapi?.ConfigAPI
  if (!api) throw new Error('ConfigAPI 未绑定')
  return api
}

export const configService = {
  getCurrent: async () => {
    if (IS_SERVER_MODE) return http.get<CurrentConfigResult>('/api/config')
    const result = await getDesktopAPI().GetCurrent()
    return unwrapResult(result as any) as CurrentConfigResult
  },
  update: async (req: { config: AppConfig; comment?: string; operator?: string }) => {
    if (IS_SERVER_MODE) return http.put<CurrentConfigResult>('/api/config', req)
    const result = await getDesktopAPI().Update(req)
    return unwrapResult(result as any) as CurrentConfigResult
  },
  listSnapshots: async (req: { limit?: number; offset?: number } = {}) => {
    if (IS_SERVER_MODE) return http.get<ConfigSnapshotListResult>('/api/config/snapshots', req as any)
    const result = await getDesktopAPI().ListSnapshots(req)
    return unwrapResult(result as any) as ConfigSnapshotListResult
  },
  getSnapshot: async (id: number) => {
    if (IS_SERVER_MODE) return http.get<ConfigSnapshotDetailResult>(`/api/config/snapshots/${id}`)
    const result = await getDesktopAPI().GetSnapshot(id)
    return unwrapResult(result as any) as ConfigSnapshotDetailResult
  },
  rollback: async (req: { snapshot_id: number; comment?: string; operator?: string }) => {
    if (IS_SERVER_MODE) return http.post<CurrentConfigResult>('/api/config/rollback', req)
    const result = await getDesktopAPI().Rollback(req)
    return unwrapResult(result as any) as CurrentConfigResult
  },
}
import { IS_SERVER_MODE, http, unwrapResult } from '@/lib/apiClient'
import type { AuditCleanupResult, AuditListResult } from '@/types/audit'

function getDesktopAPI() {
  const api = (window as any).go?.auditapi?.AuditAPI
  if (!api) throw new Error('AuditAPI 未绑定')
  return api
}

export const auditService = {
  list: async (req: {
    module?: string
    action?: string
    plugin_type?: string
    success?: boolean
    keyword?: string
    limit?: number
    offset?: number
  }) => {
    if (IS_SERVER_MODE) {
      return http.get<AuditListResult>('/api/audits', req as Record<string, string | number | undefined>)
    }
    const result = await getDesktopAPI().ListAuditLogs(req)
    return unwrapResult(result as any) as AuditListResult
  },
  cleanup: async () => {
    if (IS_SERVER_MODE) {
      return http.post<AuditCleanupResult>('/api/audits/cleanup')
    }
    const result = await getDesktopAPI().CleanupAuditLogs()
    return unwrapResult(result as any) as AuditCleanupResult
  },
}

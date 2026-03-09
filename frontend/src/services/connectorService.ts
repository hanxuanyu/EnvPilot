import { IS_SERVER_MODE, http } from '@/lib/apiClient'
import type { CommandResult, MQMessage, QueryResult, SendResult } from '@/types/connector'

interface WailsResult<T> {
  success: boolean
  data: T
  message?: string
}

function unwrap<T>(result: WailsResult<T>): T {
  if (!result.success) throw new Error(result.message || '操作失败')
  return result.data
}

function getDesktopAPI(): any {
  const api = (window as any)?.go?.connectorapi?.ConnectorAPI
  if (!api) throw new Error('桌面模式连接器 API 未就绪')
  return api
}

export const connectorService = {
  testConnection: async (assetId: number) => {
    if (IS_SERVER_MODE) return http.post<boolean>('/api/connectors/test', { asset_id: assetId })
    return unwrap<boolean>(await getDesktopAPI().TestConnection(assetId))
  },

  listDatabases: async (assetId: number) => {
    if (IS_SERVER_MODE) return http.get<string[]>(`/api/connectors/${assetId}/databases`) ?? []
    return unwrap<string[]>(await getDesktopAPI().ListDatabases(assetId)) ?? []
  },

  listTables: async (assetId: number, database = '') => {
    if (IS_SERVER_MODE) {
      return http.get<string[]>(`/api/connectors/${assetId}/tables`, { database }) ?? []
    }
    return unwrap<string[]>(await getDesktopAPI().ListTables({ asset_id: assetId, database })) ?? []
  },

  executeSQL: async (req: {
    asset_id: number
    database?: string
    query: string
    limit?: number
  }) => {
    if (IS_SERVER_MODE) return http.post<QueryResult>('/api/connectors/sql', req)
    return unwrap<QueryResult>(await getDesktopAPI().ExecuteSQL(req))
  },

  executeRedisCmd: async (req: {
    asset_id: number
    command: string
    args?: string[]
  }) => {
    if (IS_SERVER_MODE) return http.post<CommandResult>('/api/connectors/redis', req)
    return unwrap<CommandResult>(await getDesktopAPI().ExecuteRedisCmd(req))
  },

  sendMQMessage: async (req: {
    asset_id: number
    message: MQMessage
  }) => {
    if (IS_SERVER_MODE) return http.post<SendResult>('/api/connectors/mq', req)
    return unwrap<SendResult>(await getDesktopAPI().SendMQMessage(req))
  },
}
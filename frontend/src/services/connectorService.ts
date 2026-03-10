import { IS_SERVER_MODE, http } from '@/lib/apiClient'
import { notifyAuthFailure } from '@/lib/authEvents'
import type {
  CacheCatalog,
  CacheKeyDetail,
  CacheKeyInput,
  CacheKeyPage,
  CacheMutationResult,
  CommandResult,
  DatabaseCatalog,
  MQMessage,
  QueryResult,
  SendResult,
  TableDetail,
} from '@/types/connector'

interface WailsResult<T> {
  success: boolean
  data: T
  message?: string
}

function unwrap<T>(result: WailsResult<T>): T {
  if (!result.success) {
    notifyAuthFailure(result.message)
    throw new Error(result.message || '操作失败')
  }
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

  getDatabaseCatalog: async (assetId: number) => {
    if (IS_SERVER_MODE) return http.get<DatabaseCatalog>(`/api/connectors/${assetId}/catalog`)
    return unwrap<DatabaseCatalog>(await getDesktopAPI().GetDatabaseCatalog(assetId))
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

  getTableDetail: async (req: {
    asset_id: number
    database?: string
    table: string
  }) => {
    if (IS_SERVER_MODE) return http.post<TableDetail>('/api/connectors/table-detail', req)
    return unwrap<TableDetail>(await getDesktopAPI().GetTableDetail(req))
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
    database?: number
    command: string
    args?: string[]
  }) => {
    if (IS_SERVER_MODE) return http.post<CommandResult>('/api/connectors/redis', req)
    return unwrap<CommandResult>(await getDesktopAPI().ExecuteRedisCmd(req))
  },

  getCacheCatalog: async (assetId: number) => {
    if (IS_SERVER_MODE) return http.get<CacheCatalog>(`/api/connectors/${assetId}/cache/catalog`)
    return unwrap<CacheCatalog>(await getDesktopAPI().GetCacheCatalog(assetId))
  },

  listCacheKeys: async (req: {
    asset_id: number
    database: number
    pattern?: string
    cursor?: number
    limit?: number
  }) => {
    if (IS_SERVER_MODE) return http.post<CacheKeyPage>('/api/connectors/cache/keys', req)
    return unwrap<CacheKeyPage>(await getDesktopAPI().ListCacheKeys(req))
  },

  getCacheKeyDetail: async (req: {
    asset_id: number
    database: number
    key: string
  }) => {
    if (IS_SERVER_MODE) return http.post<CacheKeyDetail>('/api/connectors/cache/key-detail', req)
    return unwrap<CacheKeyDetail>(await getDesktopAPI().GetCacheKeyDetail(req))
  },

  saveCacheKey: async (req: {
    asset_id: number
    input: CacheKeyInput
  }) => {
    if (IS_SERVER_MODE) return http.post<CacheMutationResult>('/api/connectors/cache/key-save', req)
    return unwrap<CacheMutationResult>(await getDesktopAPI().SaveCacheKey(req))
  },

  deleteCacheKey: async (req: {
    asset_id: number
    database: number
    key: string
  }) => {
    if (IS_SERVER_MODE) return http.post<CacheMutationResult>('/api/connectors/cache/key-delete', req)
    return unwrap<CacheMutationResult>(await getDesktopAPI().DeleteCacheKey(req))
  },

  sendMQMessage: async (req: {
    asset_id: number
    message: MQMessage
  }) => {
    if (IS_SERVER_MODE) return http.post<SendResult>('/api/connectors/mq', req)
    return unwrap<SendResult>(await getDesktopAPI().SendMQMessage(req))
  },
}
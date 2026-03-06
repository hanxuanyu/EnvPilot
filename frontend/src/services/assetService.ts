// assetService.ts — 资产管理模块后端调用封装（桌面 / 服务端双模式）
import { IS_SERVER_MODE, http, unwrapResult } from '@/lib/apiClient'
import type { PluginDef } from '@/types/asset'

// ── 桌面模式：Wails 绑定 ──────────────────────────────────────────
import * as AssetAPIJs from '@wailsjs/go/assetapi/AssetAPI'

function wailsUnwrap<T>(result: { success: boolean; data: T; message: string }): T {
  if (!result.success) throw new Error(result.message || '操作失败')
  return result.data
}

// ── 环境管理 ──────────────────────────────────────────────────────

export const environmentService = {
  list: async () => {
    if (IS_SERVER_MODE) return http.get<any[]>('/api/environments') ?? []
    const r = await AssetAPIJs.ListEnvironments()
    return wailsUnwrap(r as any) ?? []
  },
  create: async (req: { name: string; description: string; color: string }) => {
    if (IS_SERVER_MODE) return http.post<any>('/api/environments', req)
    const r = await AssetAPIJs.CreateEnvironment(req as any)
    return wailsUnwrap(r as any)
  },
  update: async (req: { id: number; name: string; description: string; color: string }) => {
    if (IS_SERVER_MODE) return http.put<any>(`/api/environments/${req.id}`, req)
    const r = await AssetAPIJs.UpdateEnvironment(req as any)
    return wailsUnwrap(r as any)
  },
  delete: async (id: number) => {
    if (IS_SERVER_MODE) { await http.delete<any>(`/api/environments/${id}`); return }
    const r = await AssetAPIJs.DeleteEnvironment(id)
    wailsUnwrap(r as any)
  },
}

// ── 分组管理 ──────────────────────────────────────────────────────

export const groupService = {
  listByEnvironment: async (envId: number) => {
    if (IS_SERVER_MODE)
      return http.get<any[]>('/api/groups', { environment_id: envId }) ?? []
    const r = await AssetAPIJs.ListGroupsByEnvironment(envId)
    return wailsUnwrap(r as any) ?? []
  },
  create: async (req: { environment_id: number; name: string; description: string }) => {
    if (IS_SERVER_MODE) return http.post<any>('/api/groups', req)
    const r = await AssetAPIJs.CreateGroup(req as any)
    return wailsUnwrap(r as any)
  },
  update: async (req: { id: number; name: string; description: string }) => {
    if (IS_SERVER_MODE) return http.put<any>(`/api/groups/${req.id}`, req)
    const r = await AssetAPIJs.UpdateGroup(req as any)
    return wailsUnwrap(r as any)
  },
  delete: async (id: number) => {
    if (IS_SERVER_MODE) { await http.delete<any>(`/api/groups/${id}`); return }
    const r = await AssetAPIJs.DeleteGroup(id)
    wailsUnwrap(r as any)
  },
}

// ── 资产管理 ──────────────────────────────────────────────────────

export const assetService = {
  list: async (req: {
    environment_id?: number
    group_id?: number
    category?: string
    plugin_type?: string
    keyword?: string
  } = {}) => {
    if (IS_SERVER_MODE)
      return http.get<any[]>('/api/assets', req as any) ?? []
    const r = await AssetAPIJs.ListAssets({
      environment_id: req.environment_id ?? 0,
      group_id: req.group_id ?? 0,
      category: req.category ?? '',
      plugin_type: req.plugin_type ?? '',
      keyword: req.keyword ?? '',
    } as any)
    return wailsUnwrap(r as any) ?? []
  },
  get: async (id: number) => {
    if (IS_SERVER_MODE) return http.get<any>(`/api/assets/${id}`)
    const r = await AssetAPIJs.GetAsset(id)
    return wailsUnwrap(r as any)
  },
  create: async (req: {
    environment_id: number
    group_id?: number
    category: string
    plugin_type: string
    name: string
    description: string
    tags: string[]
    credential_id?: number
    ext_config: Record<string, unknown>
  }) => {
    if (IS_SERVER_MODE) return http.post<any>('/api/assets', req)
    const r = await AssetAPIJs.CreateAsset(req as any)
    return wailsUnwrap(r as any)
  },
  update: async (req: {
    id: number
    group_id?: number
    name: string
    description: string
    tags: string[]
    credential_id?: number
    ext_config: Record<string, unknown>
  }) => {
    if (IS_SERVER_MODE) return http.put<any>(`/api/assets/${req.id}`, req)
    const r = await AssetAPIJs.UpdateAsset(req as any)
    return wailsUnwrap(r as any)
  },
  delete: async (id: number) => {
    if (IS_SERVER_MODE) { await http.delete<any>(`/api/assets/${id}`); return }
    const r = await AssetAPIJs.DeleteAsset(id)
    wailsUnwrap(r as any)
  },
}

// ── 凭据管理 ──────────────────────────────────────────────────────

export const credentialService = {
  list: async () => {
    if (IS_SERVER_MODE) return http.get<any[]>('/api/credentials') ?? []
    const r = await AssetAPIJs.ListCredentials()
    return wailsUnwrap(r as any) ?? []
  },
  create: async (req: { name: string; type: string; username: string; secret: string }) => {
    if (IS_SERVER_MODE) return http.post<any>('/api/credentials', req)
    const r = await AssetAPIJs.CreateCredential(req as any)
    return wailsUnwrap(r as any)
  },
  update: async (req: { id: number; name: string; type: string; username: string; secret: string }) => {
    if (IS_SERVER_MODE) return http.put<any>(`/api/credentials/${req.id}`, req)
    const r = await AssetAPIJs.UpdateCredential(req as any)
    return wailsUnwrap(r as any)
  },
  delete: async (id: number) => {
    if (IS_SERVER_MODE) { await http.delete<any>(`/api/credentials/${id}`); return }
    const r = await AssetAPIJs.DeleteCredential(id)
    wailsUnwrap(r as any)
  },
  reveal: async (id: number): Promise<string> => {
    if (IS_SERVER_MODE) return http.post<string>(`/api/credentials/${id}/reveal`)
    const r = await AssetAPIJs.RevealCredential(id)
    return wailsUnwrap(r as any)
  },
}

// ── 插件管理 ──────────────────────────────────────────────────────

export const pluginService = {
  list: async (category = '') => {
    if (IS_SERVER_MODE)
      return http.get<PluginDef[]>('/api/plugins', category ? { category } : {}) ?? []
    const r = await AssetAPIJs.ListPlugins(category)
    return (wailsUnwrap(r as any) ?? []) as PluginDef[]
  },
  getSchema: async (pluginType: string) => {
    if (IS_SERVER_MODE) return http.get<PluginDef>(`/api/plugins/${pluginType}/schema`)
    const r = await AssetAPIJs.GetPluginSchema(pluginType)
    return wailsUnwrap(r as any) as PluginDef
  },
}

// 兼容旧导出（避免修改其他文件）
export { unwrapResult }

// assetService.ts 资产管理模块的后端调用封装
//
// 重要说明：
//   - 导入路径使用 @wailsjs 别名（指向 wailsjs/ 目录，由 wails dev 自动生成）
//   - Wails 按 Go 包名分目录：AssetAPI 在 go/assetapi/ 下（package assetapi）
//   - 统一处理 Result 包装，对页面层暴露简洁的 async 接口
import * as AssetAPIJs from '@wailsjs/go/assetapi/AssetAPI'
import type { model } from '@wailsjs/go/models'

// ── 内部工具：解包 Result，失败时抛出错误 ──────────────────────
function unwrap<T>(result: { ok: boolean; data: T; message: string }): T {
  if (!result.ok) {
    throw new Error(result.message || '操作失败')
  }
  return result.data
}

// ── 类型别名（直接使用 Wails 生成的 model 类型）───────────────
export type Environment = model.Environment
export type Group = model.Group
export type Asset = model.Asset
export type Credential = model.Credential

// ── 环境管理 ──────────────────────────────────────────────────
export const environmentService = {
  list: async (): Promise<Environment[]> => {
    const r = await AssetAPIJs.ListEnvironments()
    return (unwrap(r as any) as Environment[]) ?? []
  },
  create: async (req: { name: string; description: string; color: string }): Promise<Environment> => {
    const r = await AssetAPIJs.CreateEnvironment(req as any)
    return unwrap(r as any) as Environment
  },
  update: async (req: { id: number; name: string; description: string; color: string }): Promise<Environment> => {
    const r = await AssetAPIJs.UpdateEnvironment(req as any)
    return unwrap(r as any) as Environment
  },
  delete: async (id: number): Promise<void> => {
    const r = await AssetAPIJs.DeleteEnvironment(id)
    unwrap(r as any)
  },
}

// ── 分组管理 ──────────────────────────────────────────────────
export const groupService = {
  listByEnvironment: async (envId: number): Promise<Group[]> => {
    const r = await AssetAPIJs.ListGroupsByEnvironment(envId)
    return (unwrap(r as any) as Group[]) ?? []
  },
  create: async (req: { environment_id: number; name: string; description: string }): Promise<Group> => {
    const r = await AssetAPIJs.CreateGroup(req as any)
    return unwrap(r as any) as Group
  },
  update: async (req: { id: number; name: string; description: string }): Promise<Group> => {
    const r = await AssetAPIJs.UpdateGroup(req as any)
    return unwrap(r as any) as Group
  },
  delete: async (id: number): Promise<void> => {
    const r = await AssetAPIJs.DeleteGroup(id)
    unwrap(r as any)
  },
}

// ── 资产管理 ──────────────────────────────────────────────────
export const assetService = {
  list: async (req: {
    environment_id?: number; group_id?: number; type?: string; keyword?: string
  } = {}): Promise<Asset[]> => {
    const r = await AssetAPIJs.ListAssets({
      environment_id: req.environment_id ?? 0,
      group_id: req.group_id ?? 0,
      type: req.type ?? '',
      keyword: req.keyword ?? '',
    } as any)
    return (unwrap(r as any) as Asset[]) ?? []
  },
  get: async (id: number): Promise<Asset> => {
    const r = await AssetAPIJs.GetAsset(id)
    return unwrap(r as any) as Asset
  },
  create: async (req: {
    environment_id: number; group_id?: number; type: string; name: string;
    host: string; port: number; description: string; tags: string[]; credential_id?: number
  }): Promise<Asset> => {
    const r = await AssetAPIJs.CreateAsset(req as any)
    return unwrap(r as any) as Asset
  },
  update: async (req: {
    id: number; group_id?: number; name: string; host: string; port: number;
    description: string; tags: string[]; credential_id?: number
  }): Promise<Asset> => {
    const r = await AssetAPIJs.UpdateAsset(req as any)
    return unwrap(r as any) as Asset
  },
  delete: async (id: number): Promise<void> => {
    const r = await AssetAPIJs.DeleteAsset(id)
    unwrap(r as any)
  },
}

// ── 凭据管理 ──────────────────────────────────────────────────
export const credentialService = {
  list: async (): Promise<Credential[]> => {
    const r = await AssetAPIJs.ListCredentials()
    return (unwrap(r as any) as Credential[]) ?? []
  },
  create: async (req: { name: string; type: string; username: string; secret: string }): Promise<Credential> => {
    const r = await AssetAPIJs.CreateCredential(req as any)
    return unwrap(r as any) as Credential
  },
  update: async (req: { id: number; name: string; type: string; username: string; secret: string }): Promise<Credential> => {
    const r = await AssetAPIJs.UpdateCredential(req as any)
    return unwrap(r as any) as Credential
  },
  delete: async (id: number): Promise<void> => {
    const r = await AssetAPIJs.DeleteCredential(id)
    unwrap(r as any)
  },
}

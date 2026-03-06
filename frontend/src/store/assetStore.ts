// assetStore.ts 资产管理全局状态（Zustand）
import { create } from 'zustand'
import type { Environment, Group, Asset, Credential } from '@/services/assetService'
import {
  environmentService,
  groupService,
  assetService,
  credentialService,
} from '@/services/assetService'

interface ListAssetsReq {
  environment_id?: number
  group_id?: number
  type?: string
  keyword?: string
}

interface AssetState {
  // ── 数据 ──
  environments: Environment[]
  groups: Group[]
  assets: Asset[]
  credentials: Credential[]

  // ── 当前选中状态 ──
  selectedEnvId: number | null
  selectedGroupId: number | null

  // ── 加载状态 ──
  loading: boolean
  error: string | null

  // ── 操作 ──
  loadEnvironments: () => Promise<void>
  loadGroups: (envId: number) => Promise<void>
  loadAssets: (req?: ListAssetsReq) => Promise<void>
  loadCredentials: () => Promise<void>

  setSelectedEnv: (id: number | null) => void
  setSelectedGroup: (id: number | null) => void
  setError: (msg: string | null) => void
}

export const useAssetStore = create<AssetState>((set, get) => ({
  environments: [],
  groups: [],
  assets: [],
  credentials: [],
  selectedEnvId: null,
  selectedGroupId: null,
  loading: false,
  error: null,

  loadEnvironments: async () => {
    set({ loading: true, error: null })
    try {
      const list = await environmentService.list()
      set({ environments: list })
    } catch (e: any) {
      set({ error: e.message })
    } finally {
      set({ loading: false })
    }
  },

  loadGroups: async (envId: number) => {
    set({ loading: true, error: null })
    try {
      const list = await groupService.listByEnvironment(envId)
      set({ groups: list })
    } catch (e: any) {
      set({ error: e.message })
    } finally {
      set({ loading: false })
    }
  },

  loadAssets: async (req: ListAssetsReq = {}) => {
    set({ loading: true, error: null })
    try {
      const { selectedEnvId, selectedGroupId } = get()
      const list = await assetService.list({
        environment_id: req.environment_id ?? selectedEnvId ?? undefined,
        group_id: req.group_id ?? selectedGroupId ?? undefined,
        type: req.type,
        keyword: req.keyword,
      })
      set({ assets: list })
    } catch (e: any) {
      set({ error: e.message })
    } finally {
      set({ loading: false })
    }
  },

  loadCredentials: async () => {
    set({ loading: true, error: null })
    try {
      const list = await credentialService.list()
      set({ credentials: list })
    } catch (e: any) {
      set({ error: e.message })
    } finally {
      set({ loading: false })
    }
  },

  setSelectedEnv: (id) => set({ selectedEnvId: id, selectedGroupId: null }),
  setSelectedGroup: (id) => set({ selectedGroupId: id }),
  setError: (msg) => set({ error: msg }),
}))

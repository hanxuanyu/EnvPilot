// assetStore.ts — 资产管理全局状态（Zustand）
import { create } from 'zustand'
import { toast } from 'sonner'
import type { Asset, Environment, Group, Credential, PluginDef, AssetCategory } from '@/types/asset'
import {
  environmentService,
  groupService,
  assetService,
  credentialService,
  pluginService,
} from '@/services/assetService'

interface ListAssetsReq {
  environment_id?: number
  group_id?: number
  category?: AssetCategory | ''
  plugin_type?: string
  keyword?: string
}

interface AssetStore {
  // 数据状态
  environments: Environment[]
  groups: Group[]
  assets: Asset[]
  credentials: Credential[]
  plugins: PluginDef[]

  // 筛选状态
  selectedEnvId: number | null
  selectedGroupId: number | null

  loading: boolean
  error: string | null

  // Actions
  loadEnvironments: () => Promise<void>
  loadGroups: (envId: number) => Promise<void>
  loadAssets: (req?: ListAssetsReq) => Promise<void>
  loadCredentials: () => Promise<void>
  loadPlugins: (category?: AssetCategory | '') => Promise<void>

  setSelectedEnv: (id: number | null) => void
  setSelectedGroup: (id: number | null) => void
  setError: (msg: string | null) => void

  // 便捷查询
  getPluginDef: (typeId: string) => PluginDef | undefined
}

export const useAssetStore = create<AssetStore>((set, get) => ({
  environments: [],
  groups: [],
  assets: [],
  credentials: [],
  plugins: [],
  selectedEnvId: null,
  selectedGroupId: null,
  loading: false,
  error: null,

  loadEnvironments: async () => {
    set({ loading: true, error: null })
    try {
      const list = await environmentService.list() as Environment[]
      set({ environments: list })
    } catch (e: any) {
      const msg = e.message ?? '加载环境列表失败'
      set({ error: msg })
      toast.error(msg)
    } finally {
      set({ loading: false })
    }
  },

  loadGroups: async (envId) => {
    set({ loading: true, error: null })
    try {
      const list = await groupService.listByEnvironment(envId) as Group[]
      set({ groups: list })
    } catch (e: any) {
      const msg = e.message ?? '加载分组失败'
      set({ error: msg })
      toast.error(msg)
    } finally {
      set({ loading: false })
    }
  },

  loadAssets: async (req = {}) => {
    set({ loading: true, error: null })
    try {
      const { selectedEnvId, selectedGroupId } = get()
      const list = await assetService.list({
        environment_id: req.environment_id ?? (selectedEnvId ?? undefined),
        group_id: req.group_id ?? (selectedGroupId ?? undefined),
        category: req.category,
        plugin_type: req.plugin_type,
        keyword: req.keyword,
      }) as Asset[]
      set({ assets: list })
    } catch (e: any) {
      const msg = e.message ?? '加载资产列表失败'
      set({ error: msg })
      toast.error(msg)
    } finally {
      set({ loading: false })
    }
  },

  loadCredentials: async () => {
    set({ loading: true, error: null })
    try {
      const list = await credentialService.list() as Credential[]
      set({ credentials: list })
    } catch (e: any) {
      const msg = e.message ?? '加载凭据失败'
      set({ error: msg })
      toast.error(msg)
    } finally {
      set({ loading: false })
    }
  },

  loadPlugins: async (category = '') => {
    try {
      const list = await pluginService.list(category)
      set({ plugins: list })
    } catch (e: any) {
      toast.error('加载插件列表失败', { description: e.message })
    }
  },

  setSelectedEnv: (id) => set({ selectedEnvId: id, selectedGroupId: null }),
  setSelectedGroup: (id) => set({ selectedGroupId: id }),
  setError: (msg) => set({ error: msg }),

  getPluginDef: (typeId) => get().plugins.find(p => p.type_id === typeId),
}))

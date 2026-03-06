// asset.ts — 资产管理模块前端类型定义

// ── 通用响应包装 ──

export interface Result<T> {
  success: boolean
  data: T
  message: string
}

// ── 环境 / 分组 / 凭据 ──

export interface Environment {
  id: number
  name: string
  description: string
  color: string
  created_at: string
  updated_at: string
  groups?: Group[]
}

export interface Group {
  id: number
  environment_id: number
  name: string
  description: string
  created_at: string
  updated_at: string
  environment?: Environment
}

export type CredentialType = 'password' | 'ssh_key' | 'token'

export interface Credential {
  id: number
  name: string
  type: CredentialType
  username: string
  secret_masked?: string
  created_at: string
  updated_at: string
}

// ── 插件 Schema ──

export type ConfigFieldType =
  | 'text'
  | 'number'
  | 'password'
  | 'textarea'
  | 'boolean'
  | 'select'

export interface SelectOption {
  value: string
  label: string
}

export interface ConfigField {
  key: string
  label: string
  type: ConfigFieldType
  required: boolean
  default_val?: unknown
  options?: SelectOption[]
  placeholder?: string
  description?: string
  secret?: boolean
}

export type AssetCategory = 'server' | 'database' | 'cache' | 'mq' | 'other'

export interface PluginDef {
  type_id: string
  display_name: string
  category: AssetCategory
  icon_name: string
  config_schema: ConfigField[]
}

// ── 资产 ──

export type AssetStatus = 'unknown' | 'online' | 'offline' | 'warning'

export interface Asset {
  id: number
  environment_id: number
  group_id?: number
  category: AssetCategory
  plugin_type: string
  name: string
  description: string
  tags: string[]
  credential_id?: number
  status: AssetStatus
  last_checked_at?: string
  ext_config: Record<string, unknown>
  created_at: string
  updated_at: string
  environment?: Environment
  group?: Group
  credential?: Credential
}

// ── 请求体类型 ──

export interface CreateEnvironmentReq {
  name: string
  description: string
  color: string
}

export interface UpdateEnvironmentReq extends CreateEnvironmentReq {
  id: number
}

export interface CreateGroupReq {
  environment_id: number
  name: string
  description: string
}

export interface UpdateGroupReq {
  id: number
  name: string
  description: string
}

export interface CreateAssetReq {
  environment_id: number
  group_id?: number
  category: AssetCategory
  plugin_type: string
  name: string
  description: string
  tags: string[]
  credential_id?: number
  ext_config: Record<string, unknown>
}

export interface UpdateAssetReq {
  id: number
  group_id?: number
  name: string
  description: string
  tags: string[]
  credential_id?: number
  ext_config: Record<string, unknown>
}

export interface ListAssetsReq {
  environment_id?: number
  group_id?: number
  category?: AssetCategory | ''
  plugin_type?: string
  keyword?: string
}

export interface CreateCredentialReq {
  name: string
  type: CredentialType
  username: string
  secret: string
}

export interface UpdateCredentialReq {
  id: number
  name: string
  type: CredentialType
  username: string
  secret: string
}

// ── 展示辅助常量 ──

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  server: '服务器',
  database: '数据库',
  cache: '缓存',
  mq: '消息队列',
  other: '其他',
}

export const CATEGORY_COLORS: Record<AssetCategory, string> = {
  server: '#60a5fa',
  database: '#f97316',
  cache: '#ef4444',
  mq: '#8b5cf6',
  other: '#6b7280',
}

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  unknown: '未检测',
  online: '在线',
  offline: '离线',
  warning: '告警',
}

export const ASSET_STATUS_COLORS: Record<AssetStatus, string> = {
  unknown: '#6b7280',
  online: '#22c55e',
  offline: '#ef4444',
  warning: '#f59e0b',
}

/** 从 ext_config 中提取可展示的连接地址 */
export function getAssetAddress(asset: Asset): string {
  const cfg = asset.ext_config ?? {}
  const host = cfg['host'] as string | undefined
  const port = cfg['port'] as number | undefined
  if (host && port) return `${host}:${port}`
  if (host) return host
  // RocketMQ
  const ns = cfg['name_server'] as string | undefined
  if (ns) return ns
  // Kafka
  const brokers = cfg['brokers'] as string | undefined
  if (brokers) return brokers
  return '—'
}

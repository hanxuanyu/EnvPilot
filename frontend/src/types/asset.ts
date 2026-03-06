// asset.ts 资产管理模块的前端类型定义
// 与 Go 后端 model 保持一致

// ── 通用响应包装 ──────────────────────────────────────
export interface Result<T> {
  ok: boolean
  data: T
  message: string
}

// ── 环境 ──────────────────────────────────────────────
export interface Environment {
  id: number
  name: string
  description: string
  color: string
  created_at: string
  updated_at: string
  groups?: Group[]
}

// ── 分组 ──────────────────────────────────────────────
export interface Group {
  id: number
  environment_id: number
  name: string
  description: string
  created_at: string
  updated_at: string
  environment?: Environment
}

// ── 凭据类型 ──────────────────────────────────────────
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

// ── 资产类型 ──────────────────────────────────────────
export type AssetType = 'server' | 'mysql' | 'redis' | 'rocketmq' | 'rabbitmq'
export type AssetStatus = 'unknown' | 'online' | 'offline' | 'warning'

export interface Asset {
  id: number
  environment_id: number
  group_id?: number
  type: AssetType
  name: string
  host: string
  port: number
  description: string
  tags: string[]
  credential_id?: number
  status: AssetStatus
  last_checked_at?: string
  created_at: string
  updated_at: string
  environment?: Environment
  group?: Group
  credential?: Credential
}

// ── 请求参数类型 ──────────────────────────────────────
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
  type: AssetType
  name: string
  host: string
  port: number
  description: string
  tags: string[]
  credential_id?: number
}

export interface UpdateAssetReq {
  id: number
  group_id?: number
  name: string
  host: string
  port: number
  description: string
  tags: string[]
  credential_id?: number
}

export interface ListAssetsReq {
  environment_id?: number
  group_id?: number
  type?: AssetType
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

// ── 资产类型展示配置 ──────────────────────────────────
export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  server: '服务器',
  mysql: 'MySQL',
  redis: 'Redis',
  rocketmq: 'RocketMQ',
  rabbitmq: 'RabbitMQ',
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

// 各资产类型的默认端口
export const ASSET_DEFAULT_PORTS: Record<AssetType, number> = {
  server: 22,
  mysql: 3306,
  redis: 6379,
  rocketmq: 9876,
  rabbitmq: 5672,
}

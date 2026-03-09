// backendService.ts — 后端基础 API（Ping / Version）
import { IS_SERVER_MODE, http } from '@/lib/apiClient'

// 桌面模式使用 Wails 绑定
import { Ping as WailsPing, GetVersion as WailsGetVersion, GetHostInfo as WailsGetHostInfo } from '@wailsjs/go/main/App'

export interface VersionInfo {
  name: string
  version: string
  commit: string
}

export interface HostInfo {
  hostname: string
  platform: string
  platform_version: string
  kernel_version: string
  architecture: string
  uptime_seconds: number
  boot_time_unix: number
  cpu_cores: number
  cpu_percent: number
  memory_total: number
  memory_used: number
  memory_percent: number
  disk_path: string
  disk_total: number
  disk_used: number
  disk_percent: number
  executable: string
  sampled_at_unix: number
}

export async function ping(): Promise<string> {
  if (IS_SERVER_MODE) {
    await http.get<string>('/api/ping')
    return 'pong'
  }
  return WailsPing()
}

export async function getVersion(): Promise<VersionInfo> {
  if (IS_SERVER_MODE) {
    return http.get<VersionInfo>('/api/version')
  }
  const result = await WailsGetVersion()
  return result as unknown as VersionInfo
}

export async function getHostInfo(): Promise<HostInfo> {
  if (IS_SERVER_MODE) {
    return http.get<HostInfo>('/api/host/info')
  }
  const result = await WailsGetHostInfo()
  return result as unknown as HostInfo
}

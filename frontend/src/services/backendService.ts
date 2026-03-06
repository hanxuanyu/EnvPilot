// backendService.ts — 后端基础 API（Ping / Version）
import { IS_SERVER_MODE, http } from '@/lib/apiClient'

// 桌面模式使用 Wails 绑定
import { Ping as WailsPing, GetVersion as WailsGetVersion } from '@wailsjs/go/main/App'

export interface VersionInfo {
  name: string
  version: string
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

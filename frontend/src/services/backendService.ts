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

interface SaveDesktopExportFileReq {
  filename: string
  data_base64: string
  title: string
  filter_display_name: string
  filter_pattern: string
}

function bytesToBase64(data: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''
  for (let index = 0; index < data.length; index += chunkSize) {
    const chunk = data.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
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

export async function saveDesktopExportFile(input: {
  filename: string
  data: Uint8Array
  title?: string
  filterDisplayName?: string
  filterPattern?: string
}): Promise<string | null> {
  if (IS_SERVER_MODE) {
    throw new Error('saveDesktopExportFile 仅支持桌面模式')
  }

  const request: SaveDesktopExportFileReq = {
    filename: input.filename,
    data_base64: bytesToBase64(input.data),
    title: input.title ?? '保存文件',
    filter_display_name: input.filterDisplayName ?? '所有文件',
    filter_pattern: input.filterPattern ?? '*.*',
  }

  const saveFile = (window as any)?.go?.main?.App?.SaveExportFile
  if (typeof saveFile !== 'function') {
    throw new Error('桌面导出接口尚未就绪，请重启桌面应用后重试')
  }

  const savedPath = await saveFile(request)
  return savedPath || null
}

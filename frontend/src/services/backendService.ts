// backendService.ts 后端 API 调用封装
// 统一封装所有 Wails 后端调用，方便未来替换和单元测试
import { Ping, GetVersion } from '@wailsjs/go/main/App'

// 版本信息类型
export interface VersionInfo {
  name: string
  version: string
}

/**
 * ping 测试后端通信是否正常
 * @returns "pong" 表示正常
 */
export async function ping(): Promise<string> {
  return Ping()
}

/**
 * getVersion 获取应用版本信息
 */
export async function getVersion(): Promise<VersionInfo> {
  const result = await GetVersion()
  return result as unknown as VersionInfo
}

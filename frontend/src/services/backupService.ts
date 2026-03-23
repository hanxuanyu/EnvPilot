import { IS_SERVER_MODE, http, unwrapResult } from '@/lib/apiClient'
import type {
  AnalyzeImportResult,
  ExportBackupResult,
  ImportBackupResult,
} from '@/types/backup'

function getDesktopAPI() {
  const api = (window as any).go?.backupapi?.BackupAPI
  if (!api) throw new Error('BackupAPI 未绑定')
  return api
}

export function bytesToBase64(data: Uint8Array): string {
  const chunkSize = 0x8000
  let binary = ''
  for (let index = 0; index < data.length; index += chunkSize) {
    const chunk = data.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export const backupService = {
  exportBackup: async () => {
    if (IS_SERVER_MODE) {
      return http.post<ExportBackupResult>('/api/backup/export')
    }
    const result = await getDesktopAPI().ExportBackup()
    return unwrapResult(result as any) as ExportBackupResult
  },
  analyzeImport: async (data: Uint8Array) => {
    const req = { data_base64: bytesToBase64(data) }
    if (IS_SERVER_MODE) {
      return http.post<AnalyzeImportResult>('/api/backup/analyze', req)
    }
    const result = await getDesktopAPI().AnalyzeImportBackup(req)
    return unwrapResult(result as any) as AnalyzeImportResult
  },
  importBackup: async (data: Uint8Array, options?: { force?: boolean; operator?: string }) => {
    const req = {
      data_base64: bytesToBase64(data),
      force: options?.force ?? false,
      operator: options?.operator,
    }
    if (IS_SERVER_MODE) {
      return http.post<ImportBackupResult>('/api/backup/import', req)
    }
    const result = await getDesktopAPI().ImportBackup(req)
    return unwrapResult(result as any) as ImportBackupResult
  },
}

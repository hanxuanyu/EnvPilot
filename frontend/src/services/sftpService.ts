import { buildApiURL, http, IS_SERVER_MODE, unwrapResult } from '@/lib/apiClient'
import { notifyAuthFailure } from '@/lib/authEvents'
import { saveDesktopExportFile } from '@/services/backendService'
import * as ExecutorAPIJs from '@wailsjs/go/executorapi/ExecutorAPI'

export interface SFTPEntry {
  name: string
  path: string
  is_dir: boolean
  size: number
  mode: string
  owner?: string
  group?: string
  mod_time: string
}

export interface SFTPListResult {
  path: string
  home: string
  parent?: string
  entries: SFTPEntry[]
}

export interface SFTPTransferResult {
  path: string
  size: number
}

export interface SFTPTransferProgress {
  loaded: number
  total?: number
  percent?: number
  stage: string
}

export interface SFTPDownloadedFileData {
  name: string
  path: string
  size: number
  data: Uint8Array
}

interface SFTPDownloadResult {
  name: string
  path: string
  size: number
  content_base64: string
}

interface SFTPTransferOptions {
  overwrite?: boolean
  onProgress?: (progress: SFTPTransferProgress) => void
  signal?: AbortSignal
}

function encodeBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

function decodeBase64(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function emitProgress(
  callback: SFTPTransferOptions['onProgress'],
  loaded: number,
  total: number | undefined,
  stage: string,
) {
  if (!callback) return
  callback({
    loaded,
    total,
    percent: total && total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : undefined,
    stage,
  })
}

function triggerDownload(fileName: string, data: Uint8Array, mimeType = 'application/octet-stream') {
  const payload = new ArrayBuffer(data.byteLength)
  new Uint8Array(payload).set(data)
  const blob = new Blob([payload], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function getPathFileName(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || 'download.bin'
}

function parseResponsePayload<T>(status: number, responseText: string) {
  const payload = JSON.parse(responseText || 'null') as { success: boolean; data: T; message?: string } | null
  if (status < 200 || status >= 300) {
    const message = payload?.message || `请求失败 (${status})`
    notifyAuthFailure(message)
    throw new Error(message)
  }
  if (!payload) {
    throw new Error('响应格式错误')
  }
  return unwrapResult(payload)
}

function uploadWithProgress(assetId: number, filePath: string, file: File, options: SFTPTransferOptions) {
  return new Promise<SFTPTransferResult>((resolve, reject) => {
    const form = new FormData()
    form.set('asset_id', String(assetId))
    form.set('path', filePath)
    form.set('overwrite', String(Boolean(options.overwrite)))
    form.set('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', buildApiURL('/api/sftp/upload').toString())
    xhr.withCredentials = true
    xhr.upload.onprogress = (event) => {
      emitProgress(options.onProgress, event.loaded, event.lengthComputable ? event.total : file.size, '上传中')
    }
    xhr.onerror = () => reject(new Error('上传失败'))
    xhr.onload = () => {
      try {
        const result = parseResponsePayload<SFTPTransferResult>(xhr.status, xhr.responseText)
        emitProgress(options.onProgress, file.size, file.size, '上传完成')
        resolve(result)
      } catch (error) {
        reject(error instanceof Error ? error : new Error('上传失败'))
      }
    }
    xhr.send(form)
  })
}

function readFileAsArrayBuffer(file: File, onProgress?: SFTPTransferOptions['onProgress']) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onprogress = (event) => {
      emitProgress(onProgress, event.loaded, event.lengthComputable ? event.total : file.size, '读取本地文件')
    }
    reader.onerror = () => reject(new Error('读取本地文件失败'))
    reader.onload = () => {
      const result = reader.result
      if (!(result instanceof ArrayBuffer)) {
        reject(new Error('读取本地文件失败'))
        return
      }
      resolve(result)
    }
    reader.readAsArrayBuffer(file)
  })
}

async function downloadWithProgress(assetId: number, filePath: string, options: SFTPTransferOptions = {}): Promise<SFTPDownloadedFileData> {
  const response = await fetch(buildApiURL('/api/sftp/download', { asset_id: assetId, path: filePath }).toString(), {
    credentials: 'include',
    signal: options.signal,
  })
  if (!response.ok) {
    const json = await response.json().catch(() => null) as { message?: string } | null
    const message = json?.message || `下载失败 (${response.status})`
    notifyAuthFailure(message)
    throw new Error(message)
  }

  const fileName = getPathFileName(filePath)
  const total = Number(response.headers.get('content-length') || 0) || undefined
  if (!response.body) {
    const blob = await response.blob()
    ensureNotAborted(options.signal)
    const data = new Uint8Array(await blob.arrayBuffer())
    emitProgress(options.onProgress, data.byteLength, total ?? data.byteLength, '下载完成')
    return { name: fileName, path: filePath, size: data.byteLength, data }
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0

  for (;;) {
    ensureNotAborted(options.signal)
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    chunks.push(value)
    loaded += value.byteLength
    emitProgress(options.onProgress, loaded, total, '下载中')
  }

  const data = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.byteLength
  }

  emitProgress(options.onProgress, loaded, total ?? loaded, '下载完成')
  return { name: fileName, path: filePath, size: loaded, data }
}

async function getDesktopDownloadData(assetId: number, filePath: string, options: SFTPTransferOptions = {}): Promise<SFTPDownloadedFileData> {
  ensureNotAborted(options.signal)
  emitProgress(options.onProgress, 0, undefined, '从应用读取文件')
  const result = await ExecutorAPIJs.DownloadSFTPFile({ asset_id: assetId, path: filePath } as any)
  ensureNotAborted(options.signal)
  const unwrapped = unwrapResult(result as any) as SFTPDownloadResult
  emitProgress(options.onProgress, unwrapped.size, unwrapped.size, '下载完成')
  return {
    name: unwrapped.name || getPathFileName(filePath),
    path: unwrapped.path,
    size: unwrapped.size,
    data: decodeBase64(unwrapped.content_base64),
  }
}

function isTargetExistsError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('目标已存在')
}

function buildDesktopFilter(fileName: string) {
  const extension = fileName.split('.').pop()?.trim()
  if (!extension || extension === fileName) {
    return {
      filterDisplayName: '所有文件',
      filterPattern: '*',
    }
  }

  return {
    filterDisplayName: `${extension.toUpperCase()} 文件 (*.${extension})`,
    filterPattern: `*.${extension}`,
  }
}

function ensureNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('已取消下载', 'AbortError')
  }
}

async function saveFileData(fileName: string, data: Uint8Array, mimeType = 'application/octet-stream', title = '保存远端文件') {
  if (IS_SERVER_MODE) {
    triggerDownload(fileName, data, mimeType)
    return null
  }

  const filter = buildDesktopFilter(fileName)
  return saveDesktopExportFile({
    filename: fileName,
    data,
    title,
    filterDisplayName: filter.filterDisplayName,
    filterPattern: filter.filterPattern,
  })
}

export const sftpService = {
  listDirectory: async (assetId: number, filePath = ''): Promise<SFTPListResult> => {
    if (IS_SERVER_MODE) {
      return http.get<SFTPListResult>('/api/sftp/list', { asset_id: assetId, path: filePath })
    }
    const result = await ExecutorAPIJs.ListSFTPDirectory({ asset_id: assetId, path: filePath } as any)
    return unwrapResult(result as any) as SFTPListResult
  },

  createDirectory: async (assetId: number, filePath: string): Promise<string> => {
    if (IS_SERVER_MODE) {
      const result = await http.post<{ path: string }>('/api/sftp/mkdir', { asset_id: assetId, path: filePath })
      return result.path
    }
    const result = await ExecutorAPIJs.CreateSFTPDirectory({ asset_id: assetId, path: filePath } as any)
    return unwrapResult(result as any) as string
  },

  deletePath: async (assetId: number, filePath: string): Promise<void> => {
    if (IS_SERVER_MODE) {
      await http.post<boolean>('/api/sftp/delete', { asset_id: assetId, path: filePath })
      return
    }
    const result = await ExecutorAPIJs.DeleteSFTPPath({ asset_id: assetId, path: filePath } as any)
    unwrapResult(result as any)
  },

  movePath: async (assetId: number, filePath: string, targetPath: string, options: SFTPTransferOptions = {}): Promise<SFTPTransferResult> => {
    if (IS_SERVER_MODE) {
      return http.post<SFTPTransferResult>('/api/sftp/move', {
        asset_id: assetId,
        path: filePath,
        target_path: targetPath,
        overwrite: Boolean(options.overwrite),
      })
    }

    const result = await ExecutorAPIJs.MoveSFTPPath({
      asset_id: assetId,
      path: filePath,
      target_path: targetPath,
      overwrite: Boolean(options.overwrite),
    } as any)
    return unwrapResult(result as any) as SFTPTransferResult
  },

  uploadFile: async (assetId: number, filePath: string, file: File, options: SFTPTransferOptions = {}): Promise<SFTPTransferResult> => {
    if (IS_SERVER_MODE) {
      return uploadWithProgress(assetId, filePath, file, options)
    }

    emitProgress(options.onProgress, 0, file.size, '读取本地文件')
    const buffer = await readFileAsArrayBuffer(file, options.onProgress)
    emitProgress(options.onProgress, Math.floor(file.size * 0.9), file.size, '发送到应用')

    const result = await ExecutorAPIJs.UploadSFTPFile({
      asset_id: assetId,
      path: filePath,
      overwrite: Boolean(options.overwrite),
      content_base64: encodeBase64(buffer),
    } as any)
    emitProgress(options.onProgress, file.size, file.size, '上传完成')
    return unwrapResult(result as any) as SFTPTransferResult
  },

  getDownloadFileData: async (assetId: number, filePath: string, options: SFTPTransferOptions = {}): Promise<SFTPDownloadedFileData> => {
    if (IS_SERVER_MODE) {
      return downloadWithProgress(assetId, filePath, options)
    }
    return getDesktopDownloadData(assetId, filePath, options)
  },

  saveFileData,

  downloadFile: async (assetId: number, filePath: string, options: SFTPTransferOptions = {}): Promise<void> => {
    const downloaded = await sftpService.getDownloadFileData(assetId, filePath, options)
    await saveFileData(downloaded.name, downloaded.data)
  },

  isTargetExistsError,
}
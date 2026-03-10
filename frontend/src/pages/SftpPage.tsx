import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronUp,
  Copy,
  Download,
  FileText,
  Folder,
  FolderPlus,
  FolderOpen,
  HardDrive,
  PencilLine,
  RefreshCw,
  Route,
  UploadCloud,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAssetStore } from '@/store/assetStore'
import { sftpService, type SFTPEntry, type SFTPListResult } from '@/services/sftpService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Modal,
  FormField,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

type ContextMenuState = {
  open: boolean
  x: number
  y: number
  entry: SFTPEntry | null
}

type TransferState = {
  kind: 'upload' | 'download'
  currentFileName: string
  totalFiles: number
  completedFiles: number
  transferredBytes: number
  totalBytes?: number
  speedBps?: number
  stage: string
  percent?: number
}

type UploadFileProgress = {
  key: string
  name: string
  size: number
  loaded: number
  total: number
  percent?: number
  stage: string
  speedBps?: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

type DeleteConfirmState = {
  open: boolean
  entries: SFTPEntry[]
}

type MoveOverwriteConfirmState = {
  open: boolean
  targetPath: string
}

type SortKey = 'name' | 'size' | 'mod_time'

type SortDirection = 'asc' | 'desc'

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function joinRemotePath(basePath: string, child: string) {
  const trimmedChild = child.trim().replace(/^\/+/, '')
  if (!trimmedChild) return basePath || '/'
  if (!basePath || basePath === '/') return `/${trimmedChild}`
  return `${basePath.replace(/\/+$/, '')}/${trimmedChild}`
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size < 0) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatTime(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatSpeed(speedBps?: number) {
  if (!speedBps || !Number.isFinite(speedBps) || speedBps <= 0) return '计算中'
  return `${formatFileSize(speedBps)}/s`
}

function formatOwnership(entry: SFTPEntry) {
  if (entry.owner && entry.group) return `${entry.owner}:${entry.group}`
  if (entry.owner) return entry.owner
  if (entry.group) return `:${entry.group}`
  return '—'
}

function buildUploadFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function createUploadFileProgress(file: File): UploadFileProgress {
  return {
    key: buildUploadFileKey(file),
    name: file.name,
    size: file.size,
    loaded: 0,
    total: file.size,
    percent: 0,
    stage: '待上传',
    status: 'pending',
  }
}

function summarizeUploadProgress(items: UploadFileProgress[]): TransferState | null {
  if (!items.length) return null

  const totalBytes = items.reduce((sum, item) => sum + item.total, 0)
  const transferredBytes = items.reduce((sum, item) => sum + Math.min(item.loaded, item.total), 0)
  const completedFiles = items.filter(item => item.status === 'success' || item.status === 'error').length
  const activeItem = items.find(item => item.status === 'uploading') || items[items.length - 1]

  return {
    kind: 'upload',
    currentFileName: activeItem?.name || items[0].name,
    totalFiles: items.length,
    completedFiles,
    transferredBytes,
    totalBytes,
    speedBps: activeItem?.speedBps,
    stage: activeItem?.stage || '待上传',
    percent: totalBytes > 0 ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100)) : 0,
  }
}

function renderDownloadToast(state: TransferState, options?: { onCancel?: () => void; cancelDisabled?: boolean }) {
  return (
    <div className="w-[320px] space-y-2">
      <div className="flex items-start justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{state.kind === 'download' ? '下载中' : '处理中'}</p>
          <p className="truncate text-xs text-muted-foreground">{state.currentFileName}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono text-xs text-muted-foreground">{state.percent != null ? `${state.percent}%` : '处理中'}</span>
          {options?.onCancel && (
            <button
              type="button"
              className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              onClick={options.onCancel}
              disabled={options.cancelDisabled}
            >
              取消
            </button>
          )}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">{state.stage}</div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full bg-primary transition-all ${state.percent == null ? 'w-1/3 animate-pulse' : ''}`}
          style={state.percent != null ? { width: `${state.percent}%` } : undefined}
        />
      </div>
      <div className="flex items-center justify-between gap-2 font-mono text-xs text-muted-foreground">
        <span>{state.completedFiles}/{state.totalFiles} 个文件</span>
        <span>{formatFileSize(state.transferredBytes)}{state.totalBytes ? ` / ${formatFileSize(state.totalBytes)}` : ''}</span>
      </div>
      <div className="font-mono text-xs text-muted-foreground">速度: {formatSpeed(state.speedBps)}</div>
    </div>
  )
}

export default function SftpPage() {
  const { assetId: paramAssetId } = useParams<{ assetId?: string }>()
  const navigate = useNavigate()
  const { assets, loadAssets } = useAssetStore()

  const serverAssets = assets.filter(asset => asset.category === 'server')
  const [selectedAssetId, setSelectedAssetId] = useState<number>(paramAssetId ? Number(paramAssetId) : 0)
  const selectedAsset = serverAssets.find(asset => asset.id === selectedAssetId)
  const [listResult, setListResult] = useState<SFTPListResult | null>(null)
  const [pathInput, setPathInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [mkdirOpen, setMkdirOpen] = useState(false)
  const [newDirName, setNewDirName] = useState('')
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveSource, setMoveSource] = useState<SFTPEntry | null>(null)
  const [moveTargetPath, setMoveTargetPath] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadProgressMap, setUploadProgressMap] = useState<Record<string, UploadFileProgress>>({})
  const [uploadOverwrite, setUploadOverwrite] = useState(false)
  const [uploadDragOver, setUploadDragOver] = useState(false)
  const [focusedEntryPath, setFocusedEntryPath] = useState('')
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({ open: false, entries: [] })
  const [moveOverwriteConfirm, setMoveOverwriteConfirm] = useState<MoveOverwriteConfirmState>({ open: false, targetPath: '' })
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ open: false, x: 0, y: 0, entry: null })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const listViewportRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})
  const lastSelectedPathRef = useRef('')
  const downloadAbortControllerRef = useRef<AbortController | null>(null)
  const downloadCancelRequestedRef = useRef(false)

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  useEffect(() => {
    if (paramAssetId) {
      setSelectedAssetId(Number(paramAssetId))
      return
    }
    setSelectedAssetId(0)
  }, [paramAssetId])

  const loadDirectory = useCallback(async (targetPath = '') => {
    if (!selectedAssetId) return
    setLoading(true)
    try {
      const result = await sftpService.listDirectory(selectedAssetId, targetPath)
      setListResult(result)
      setPathInput(result.path)
    } catch (error: any) {
      toast.error(error.message || '读取目录失败')
    } finally {
      setLoading(false)
    }
  }, [selectedAssetId])

  useEffect(() => {
    if (!selectedAssetId) {
      setListResult(null)
      setPathInput('')
      setFocusedEntryPath('')
      setSelectedPaths([])
      return
    }
    void loadDirectory('')
  }, [selectedAssetId, loadDirectory])

  useEffect(() => {
    if (!listResult?.entries.length) {
      setFocusedEntryPath('')
      setSelectedPaths([])
      return
    }

    setFocusedEntryPath(current => {
      if (current && listResult.entries.some(entry => entry.path === current)) return current
      return listResult.entries[0]?.path || ''
    })

    setSelectedPaths(current => current.filter(path => listResult.entries.some(entry => entry.path === path)))
  }, [listResult])

  useEffect(() => {
    if (!focusedEntryPath) return
    rowRefs.current[focusedEntryPath]?.scrollIntoView({ block: 'nearest' })
  }, [focusedEntryPath])

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => (prev.open ? { ...prev, open: false, entry: null } : prev))
  }, [])

  useEffect(() => {
    if (!contextMenu.open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) return
      closeContextMenu()
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu()
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', closeContextMenu)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', closeContextMenu)
    }
  }, [closeContextMenu, contextMenu.open])

  const focusedEntry = listResult?.entries.find(entry => entry.path === focusedEntryPath) ?? null
  const selectedEntries = listResult?.entries.filter(entry => selectedPaths.includes(entry.path)) ?? []
  const selectedFileEntries = selectedEntries.filter(entry => !entry.is_dir)
  const allEntriesSelected = !!listResult?.entries.length && selectedPaths.length === listResult.entries.length
  const sortedEntries = [...(listResult?.entries ?? [])].sort((left, right) => {
    if (left.is_dir !== right.is_dir) return left.is_dir ? -1 : 1

    let result = 0
    if (sortKey === 'size') {
      result = left.size - right.size
    } else if (sortKey === 'mod_time') {
      result = new Date(left.mod_time).getTime() - new Date(right.mod_time).getTime()
    } else {
      result = left.name.localeCompare(right.name, 'zh-CN', { numeric: true, sensitivity: 'base' })
    }

    if (result === 0) {
      result = left.name.localeCompare(right.name, 'zh-CN', { numeric: true, sensitivity: 'base' })
    }

    return sortDirection === 'asc' ? result : -result
  })
  const uploadProgressItems = uploadFiles.map(file => uploadProgressMap[buildUploadFileKey(file)] ?? createUploadFileProgress(file))
  const uploadSummary = summarizeUploadProgress(uploadProgressItems)
  const uploadInProgress = busyAction.startsWith('upload:')
  const uploadCompleted = !!uploadProgressItems.length && uploadProgressItems.every(item => item.status === 'success' || item.status === 'error')
  const uploadHasFailures = uploadProgressItems.some(item => item.status === 'error')

  useEffect(() => {
    if (!sortedEntries.length) return
    setFocusedEntryPath(current => (current && sortedEntries.some(entry => entry.path === current) ? current : sortedEntries[0]?.path || ''))
  }, [sortedEntries])

  const resetUploadDialog = useCallback(() => {
    setUploadOpen(false)
    setUploadDragOver(false)
    setUploadFiles([])
    setUploadProgressMap({})
    setUploadOverwrite(false)
  }, [])

  const openEntryContextMenu = useCallback((entry: SFTPEntry, clientX: number, clientY: number) => {
    const viewportRect = listViewportRef.current?.getBoundingClientRect()
    if (!viewportRect) return

    setFocusedEntryPath(entry.path)
    setContextMenu({
      open: true,
      x: clientX - viewportRect.left,
      y: clientY - viewportRect.top,
      entry,
    })
  }, [])

  const handleNavigate = useCallback((event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (!selectedAssetId) {
      toast.warning('请先选择服务器')
      return
    }
    void loadDirectory(pathInput.trim())
  }, [loadDirectory, pathInput, selectedAssetId])

  const handleDelete = useCallback(async (entry: SFTPEntry) => {
    if (!selectedAssetId) return

    setBusyAction(`delete:${entry.path}`)
    try {
      await sftpService.deletePath(selectedAssetId, entry.path)
      toast.success(`${entry.is_dir ? '目录' : '文件'}已删除`)
      await loadDirectory(listResult?.path || '')
    } catch (error: any) {
      toast.error(error.message || '删除失败')
    } finally {
      setBusyAction('')
    }
  }, [listResult?.path, loadDirectory, selectedAssetId])

  const requestDeleteEntries = useCallback((entries: SFTPEntry[]) => {
    if (!entries.length) return
    closeContextMenu()
    setDeleteConfirm({ open: true, entries })
  }, [closeContextMenu])

  const showDownloadToast = useCallback((toastId: string | number, state: TransferState, options?: { duration?: number; onCancel?: () => void; cancelDisabled?: boolean }) => {
    toast(renderDownloadToast(state, options), {
      id: toastId,
      duration: options?.duration ?? Infinity,
      dismissible: false,
    })
  }, [])

  const dismissDownloadToastLater = useCallback((toastId: string | number) => {
    window.setTimeout(() => {
      toast.dismiss(toastId)
    }, 1200)
  }, [])

  const handleDownload = useCallback(async (entry: SFTPEntry) => {
    if (!selectedAssetId || entry.is_dir) return
    setBusyAction(`download:${entry.path}`)
    const toastId = `sftp-download:${entry.path}`
    const controller = new AbortController()
    downloadAbortControllerRef.current = controller
    downloadCancelRequestedRef.current = false
    let lastTransferred = 0
    let lastAt = performance.now()
    showDownloadToast(toastId, {
      kind: 'download',
      currentFileName: entry.name,
      totalFiles: 1,
      completedFiles: 0,
      transferredBytes: 0,
      totalBytes: entry.size || undefined,
      stage: '准备下载',
      percent: 0,
    }, {
      onCancel: () => controller.abort(),
    })
    try {
      await sftpService.downloadFile(selectedAssetId, entry.path, {
        signal: controller.signal,
        onProgress: progress => {
          const totalTransferred = Math.min(progress.loaded, entry.size || progress.total || progress.loaded)
          const now = performance.now()
          const elapsed = (now - lastAt) / 1000
          const speedBps = elapsed > 0 ? (totalTransferred - lastTransferred) / elapsed : undefined
          lastTransferred = totalTransferred
          lastAt = now
          showDownloadToast(toastId, {
            kind: 'download',
            currentFileName: entry.name,
            totalFiles: 1,
            completedFiles: progress.stage === '下载完成' ? 1 : 0,
            transferredBytes: totalTransferred,
            totalBytes: entry.size || progress.total,
            speedBps,
            stage: progress.stage,
            percent: entry.size || progress.total ? Math.min(100, Math.round((totalTransferred / (entry.size || progress.total || totalTransferred)) * 100)) : undefined,
          }, {
            onCancel: () => controller.abort(),
          })
        },
      })
      showDownloadToast(toastId, {
        kind: 'download',
        currentFileName: entry.name,
        totalFiles: 1,
        completedFiles: 1,
        transferredBytes: entry.size,
        totalBytes: entry.size || undefined,
        speedBps: lastTransferred > 0 ? lastTransferred / Math.max((performance.now() - lastAt) / 1000, 0.001) : undefined,
        stage: '下载完成，正在打开保存窗口',
        percent: 100,
      }, { duration: 2000, cancelDisabled: true })
    } catch (error: any) {
      toast.dismiss(toastId)
      if (error?.name === 'AbortError') {
        toast.warning('下载已取消')
      } else {
        toast.error(error.message || '下载失败')
      }
    } finally {
      downloadAbortControllerRef.current = null
      setBusyAction('')
      dismissDownloadToastLater(toastId)
    }
  }, [dismissDownloadToastLater, selectedAssetId, showDownloadToast])

  const openEntry = useCallback((entry: SFTPEntry) => {
    if (entry.is_dir) {
      void loadDirectory(entry.path)
      return
    }
    void handleDownload(entry)
  }, [handleDownload, loadDirectory])

  const handleChooseUpload = useCallback(() => {
    if (!selectedAssetId) {
      toast.warning('请先选择服务器')
      return
    }
    setUploadOpen(true)
    setUploadDragOver(false)
    setUploadFiles([])
    setUploadProgressMap({})
    setUploadOverwrite(false)
  }, [selectedAssetId])

  const handlePickedUploadFiles = useCallback((files: FileList | File[] | null) => {
    const nextFiles = files ? Array.from(files) : []
    if (!nextFiles.length) return
    setUploadFiles(nextFiles)
    setUploadProgressMap(Object.fromEntries(nextFiles.map(file => {
      const progress = createUploadFileProgress(file)
      return [progress.key, progress]
    })))
    setUploadDragOver(false)
  }, [])

  const handleFilePicked = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    handlePickedUploadFiles(event.target.files)
    event.target.value = ''
  }, [handlePickedUploadFiles])

  const handleCreateDirectory = useCallback(async () => {
    if (!selectedAssetId) {
      toast.warning('请先选择服务器')
      return
    }
    const targetPath = joinRemotePath(listResult?.path || '/', newDirName)
    if (!newDirName.trim()) {
      toast.warning('请输入目录名')
      return
    }

    setBusyAction(`mkdir:${targetPath}`)
    try {
      await sftpService.createDirectory(selectedAssetId, targetPath)
      toast.success('目录创建成功')
      setMkdirOpen(false)
      setNewDirName('')
      await loadDirectory(listResult?.path || '')
    } catch (error: any) {
      toast.error(error.message || '创建目录失败')
    } finally {
      setBusyAction('')
    }
  }, [listResult?.path, loadDirectory, newDirName, selectedAssetId])

  const handleOpenMove = useCallback((entry: SFTPEntry) => {
    closeContextMenu()
    setMoveSource(entry)
    setMoveTargetPath(entry.path)
    setMoveOpen(true)
  }, [closeContextMenu])

  const toggleEntrySelection = useCallback((entry: SFTPEntry, options?: { checked?: boolean; range?: boolean }) => {
    const entries = sortedEntries
    const checked = options?.checked
    const range = options?.range

    setSelectedPaths(current => {
      const next = new Set(current)

      if (range && lastSelectedPathRef.current) {
        const startIndex = entries.findIndex(item => item.path === lastSelectedPathRef.current)
        const endIndex = entries.findIndex(item => item.path === entry.path)
        if (startIndex >= 0 && endIndex >= 0) {
          const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
          for (const item of entries.slice(from, to + 1)) next.add(item.path)
          return Array.from(next)
        }
      }

      const shouldSelect = checked ?? !next.has(entry.path)
      if (shouldSelect) next.add(entry.path)
      else next.delete(entry.path)
      return Array.from(next)
    })

    lastSelectedPathRef.current = entry.path
    setFocusedEntryPath(entry.path)
  }, [sortedEntries])

  const toggleAllVisible = useCallback((checked: boolean) => {
    const entries = sortedEntries
    setSelectedPaths(checked ? entries.map(entry => entry.path) : [])
  }, [sortedEntries])

  const invertVisibleSelection = useCallback(() => {
    const visiblePaths = new Set(sortedEntries.map(entry => entry.path))
    setSelectedPaths(current => {
      const next: string[] = []
      for (const entry of sortedEntries) {
        if (!current.includes(entry.path)) next.push(entry.path)
      }
      for (const path of current) {
        if (!visiblePaths.has(path)) next.push(path)
      }
      return next
    })
  }, [sortedEntries])

  const toggleSort = useCallback((nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection(current => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(nextKey)
    setSortDirection(nextKey === 'name' ? 'asc' : 'desc')
  }, [sortKey])

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedAssetId || !selectedEntries.length) return

    let successCount = 0
    setBusyAction('delete:selected')
    try {
      for (const entry of selectedEntries) {
        try {
          await sftpService.deletePath(selectedAssetId, entry.path)
          successCount += 1
        } catch (error: any) {
          toast.error(`${entry.name} 删除失败：${error.message || '未知错误'}`)
        }
      }
      setSelectedPaths([])
      await loadDirectory(listResult?.path || '')
      if (successCount > 0) toast.success(`已删除 ${successCount} 项`)
    } finally {
      setBusyAction('')
    }
  }, [listResult?.path, loadDirectory, selectedAssetId, selectedEntries])

  const handleDownloadSelected = useCallback(async () => {
    if (!selectedAssetId || !selectedFileEntries.length) return

    const toastId = `sftp-download:selected:${selectedFileEntries.map(entry => entry.path).join('|')}`
    const controller = new AbortController()
    downloadAbortControllerRef.current = controller
    downloadCancelRequestedRef.current = false
    const totalBytes = selectedFileEntries.reduce((sum, entry) => sum + Math.max(entry.size, 0), 0)
    let completedFiles = 0
    let completedBytes = 0
    let lastTransferred = 0
    let lastAt = performance.now()
    const failures: string[] = []

    setBusyAction('download:selected')
    showDownloadToast(toastId, {
      kind: 'download',
      currentFileName: selectedFileEntries[0]?.name || '批量下载',
      totalFiles: selectedFileEntries.length,
      completedFiles: 0,
      transferredBytes: 0,
      totalBytes,
      stage: '准备下载',
      percent: 0,
    }, {
      onCancel: () => {
        downloadCancelRequestedRef.current = true
        controller.abort()
      },
    })
    try {
      const filesForZip: Array<{ path: string; name: string; data: Uint8Array }> = []
      for (const entry of selectedFileEntries) {
        if (downloadCancelRequestedRef.current) break
        await sftpService.getDownloadFileData(selectedAssetId, entry.path, {
          signal: controller.signal,
          onProgress: progress => {
            const currentLoaded = Math.min(progress.loaded, entry.size || progress.total || progress.loaded)
            const totalTransferred = completedBytes + currentLoaded
            const now = performance.now()
            const elapsed = (now - lastAt) / 1000
            const speedBps = elapsed > 0 ? (totalTransferred - lastTransferred) / elapsed : undefined
            lastTransferred = totalTransferred
            lastAt = now
            showDownloadToast(toastId, {
              kind: 'download',
              currentFileName: entry.name,
              totalFiles: selectedFileEntries.length,
              completedFiles,
              transferredBytes: totalTransferred,
              totalBytes,
              speedBps,
              stage: progress.stage,
              percent: totalBytes > 0 ? Math.min(100, Math.round((totalTransferred / totalBytes) * 100)) : undefined,
            }, {
              onCancel: () => {
                downloadCancelRequestedRef.current = true
                controller.abort()
              },
            })
          },
        }).then(downloaded => {
          completedFiles += 1
          completedBytes += entry.size
          filesForZip.push({ path: downloaded.path, name: downloaded.name, data: downloaded.data })
          showDownloadToast(toastId, {
            kind: 'download',
            currentFileName: entry.name,
            totalFiles: selectedFileEntries.length,
            completedFiles,
            transferredBytes: completedBytes,
            totalBytes,
            stage: completedFiles === selectedFileEntries.length ? '下载完成' : '准备下一个文件',
            percent: totalBytes > 0 ? Math.min(100, Math.round((completedBytes / totalBytes) * 100)) : undefined,
          }, {
            onCancel: () => {
              downloadCancelRequestedRef.current = true
              controller.abort()
            },
          })
        }).catch((error: any) => {
          if (error?.name === 'AbortError') {
            downloadCancelRequestedRef.current = true
            return
          }
          failures.push(`${entry.name}: ${error.message || '下载失败'}`)
        })
      }

      if (!downloadCancelRequestedRef.current && filesForZip.length) {
        showDownloadToast(toastId, {
          kind: 'download',
          currentFileName: '正在生成压缩包',
          totalFiles: selectedFileEntries.length,
          completedFiles,
          transferredBytes: completedBytes,
          totalBytes,
          stage: '正在打包为 ZIP',
          percent: 100,
        }, { cancelDisabled: true })
        const { default: JSZip } = await import('jszip')
        const zip = new JSZip()
        for (const file of filesForZip) {
          zip.file(file.path.replace(/^\/+/, '') || file.name, file.data)
        }
        const zipBytes = new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } }))
        const now = new Date()
        const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
        await sftpService.saveFileData(`sftp-download-${stamp}.zip`, zipBytes, 'application/zip', '保存下载压缩包')
      }

      if (downloadCancelRequestedRef.current) toast.warning('批量下载已取消')
      else if (!failures.length) toast.success(`已下载并打包 ${selectedFileEntries.length} 个文件`)
      else if (failures.length === selectedFileEntries.length) toast.error(`批量下载失败：${failures[0]}`)
      else toast.warning(`已处理 ${selectedFileEntries.length - failures.length}/${selectedFileEntries.length} 个文件，部分失败：${failures[0]}`)
    } finally {
      downloadAbortControllerRef.current = null
      setBusyAction('')
      dismissDownloadToastLater(toastId)
    }
  }, [dismissDownloadToastLater, selectedAssetId, selectedFileEntries, showDownloadToast])

  const handleMove = useCallback(async (overwrite = false) => {
    if (!selectedAssetId || !moveSource) return

    const targetPath = moveTargetPath.trim()
    if (!targetPath) {
      toast.warning('请输入目标路径')
      return
    }

    if (targetPath === moveSource.path) {
      toast.info('目标路径未变化')
      return
    }

    try {
      setBusyAction(`move:${moveSource.path}`)
      await sftpService.movePath(selectedAssetId, moveSource.path, targetPath, overwrite ? { overwrite: true } : undefined)
      toast.success('移动成功')
      setMoveOpen(false)
      setMoveSource(null)
      setMoveTargetPath('')
      setMoveOverwriteConfirm({ open: false, targetPath: '' })
      await loadDirectory(listResult?.path || '')
    } catch (error: any) {
      if (sftpService.isTargetExistsError(error) && !overwrite) {
        setMoveOverwriteConfirm({ open: true, targetPath })
      } else {
        toast.error(error.message || (overwrite ? '覆盖移动失败' : '移动失败'))
      }
    } finally {
      setBusyAction('')
    }
  }, [listResult?.path, loadDirectory, moveSource, moveTargetPath, selectedAssetId])

  const runUploadFiles = useCallback(async (filesToUpload: File[]) => {
    if (!selectedAssetId || !filesToUpload.length) {
      toast.warning('请先选择要上传的文件')
      return
    }

    const failures: string[] = []

    try {
      for (const file of filesToUpload) {
        const targetPath = joinRemotePath(listResult?.path || '/', file.name)
        const fileKey = buildUploadFileKey(file)
        setBusyAction(`upload:${targetPath}`)
        let lastTransferred = 0
        let lastAt = performance.now()
        setUploadProgressMap(current => ({
          ...current,
          [fileKey]: {
            ...(current[fileKey] || createUploadFileProgress(file)),
            loaded: 0,
            total: file.size,
            percent: 0,
            stage: '准备上传',
            status: 'uploading',
            error: undefined,
          },
        }))

        try {
          await sftpService.uploadFile(selectedAssetId, targetPath, file, {
            overwrite: uploadOverwrite,
            onProgress: progress => {
              const currentLoaded = Math.min(progress.loaded, file.size)
              const now = performance.now()
              const elapsed = (now - lastAt) / 1000
              const speedBps = elapsed > 0 ? (currentLoaded - lastTransferred) / elapsed : undefined
              lastTransferred = currentLoaded
              lastAt = now
              setUploadProgressMap(current => ({
                ...current,
                [fileKey]: {
                  ...(current[fileKey] || createUploadFileProgress(file)),
                  loaded: currentLoaded,
                  total: file.size,
                  percent: progress.percent,
                  stage: progress.stage,
                  speedBps,
                  status: progress.stage === '上传完成' ? 'success' : 'uploading',
                  error: undefined,
                },
              }))
            },
          })
          setUploadProgressMap(current => ({
            ...current,
            [fileKey]: {
              ...(current[fileKey] || createUploadFileProgress(file)),
              loaded: file.size,
              total: file.size,
              percent: 100,
              stage: '上传完成',
              speedBps: current[fileKey]?.speedBps,
              status: 'success',
              error: undefined,
            },
          }))
        } catch (error: any) {
          const message = sftpService.isTargetExistsError(error) && !uploadOverwrite ? '目标文件已存在，请开启覆盖后重试' : (error.message || '上传失败')
          failures.push(`${file.name}: ${message}`)
          setUploadProgressMap(current => ({
            ...current,
            [fileKey]: {
              ...(current[fileKey] || createUploadFileProgress(file)),
              loaded: current[fileKey]?.loaded ?? 0,
              total: file.size,
              percent: current[fileKey]?.percent,
              stage: message,
              status: 'error',
              error: message,
            },
          }))
        }
      }

      await loadDirectory(listResult?.path || '')

      if (!failures.length) {
        toast.success(filesToUpload.length > 1 ? `已上传 ${filesToUpload.length} 个文件` : '文件上传成功')
      } else if (failures.length === filesToUpload.length) {
        toast.error(`上传失败：${failures[0]}`)
      } else {
        toast.warning(`已完成 ${filesToUpload.length - failures.length}/${filesToUpload.length} 个文件，部分失败：${failures[0]}`)
      }
    } finally {
      setBusyAction('')
    }
  }, [listResult?.path, loadDirectory, selectedAssetId, uploadOverwrite])

  const handleConfirmUpload = useCallback(async () => {
    await runUploadFiles(uploadFiles)
  }, [runUploadFiles, uploadFiles])

  const handleRetryFailedUploads = useCallback(async () => {
    const failedFiles = uploadFiles.filter(file => uploadProgressMap[buildUploadFileKey(file)]?.status === 'error')
    if (!failedFiles.length) {
      toast.info('当前没有失败项可重试')
      return
    }
    await runUploadFiles(failedFiles)
  }, [runUploadFiles, uploadFiles, uploadProgressMap])

  const handleCopyPath = useCallback(async (entry: SFTPEntry) => {
    closeContextMenu()
    try {
      await writeClipboardText(entry.path)
      toast.success('路径已复制')
    } catch {
      toast.error('复制路径失败')
    }
  }, [closeContextMenu])

  const handleListKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!sortedEntries.length || !selectedAssetId) return

    const entries = sortedEntries
    const currentIndex = Math.max(0, entries.findIndex(entry => entry.path === focusedEntryPath))
    const targetEntry = focusedEntry ?? entries[0]

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setFocusedEntryPath(entries[Math.min(entries.length - 1, currentIndex + 1)]?.path || '')
      closeContextMenu()
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setFocusedEntryPath(entries[Math.max(0, currentIndex - 1)]?.path || '')
      closeContextMenu()
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setFocusedEntryPath(entries[0]?.path || '')
      closeContextMenu()
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setFocusedEntryPath(entries[entries.length - 1]?.path || '')
      closeContextMenu()
      return
    }

    if (event.key === 'Enter' && targetEntry) {
      event.preventDefault()
      closeContextMenu()
      openEntry(targetEntry)
      return
    }

    if (event.key === 'F2' && targetEntry) {
      event.preventDefault()
      handleOpenMove(targetEntry)
      return
    }

    if (event.key === 'Delete' && targetEntry) {
      event.preventDefault()
      if (selectedPaths.length > 1 && selectedPaths.includes(targetEntry.path)) {
        requestDeleteEntries(selectedEntries)
      } else {
        requestDeleteEntries([targetEntry])
      }
      return
    }

    if (event.key === ' ' && targetEntry) {
      event.preventDefault()
      toggleEntrySelection(targetEntry, { range: event.shiftKey })
      return
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      toggleAllVisible(!allEntriesSelected)
      return
    }

    if (event.key === 'Escape' && selectedPaths.length) {
      event.preventDefault()
      setSelectedPaths([])
      closeContextMenu()
      return
    }

    if ((event.key === 'Backspace' || (event.altKey && event.key === 'ArrowUp')) && listResult?.parent) {
      event.preventDefault()
      closeContextMenu()
      void loadDirectory(listResult.parent)
      return
    }

    if ((event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) && targetEntry) {
      event.preventDefault()
      const rowRect = rowRefs.current[targetEntry.path]?.getBoundingClientRect()
      const viewportRect = listViewportRef.current?.getBoundingClientRect()
      if (!rowRect || !viewportRect) return
      openEntryContextMenu(targetEntry, rowRect.left + 24, Math.min(rowRect.bottom - 8, viewportRect.bottom - 8))
    }
  }, [allEntriesSelected, closeContextMenu, focusedEntry, focusedEntryPath, handleOpenMove, listResult, loadDirectory, openEntry, openEntryContextMenu, requestDeleteEntries, selectedAssetId, selectedEntries, selectedPaths, sortedEntries, toggleAllVisible, toggleEntrySelection])

  const uploadTargetSummary = uploadFiles.length === 1
    ? joinRemotePath(listResult?.path || '/', uploadFiles[0].name)
    : `${listResult?.path || '/'} (${uploadFiles.length} 个文件)`

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-2 flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-base font-semibold text-foreground whitespace-nowrap">SFTP 文件传输</h1>
        </div>

        <div className="flex h-8 items-center overflow-hidden rounded-md border border-border bg-background">
          <Select
            value={String(selectedAssetId)}
            onValueChange={(value) => {
              const id = Number(value)
              setSelectedAssetId(id)
              navigate(id ? `/sftp/${id}` : '/sftp')
            }}
          >
            <SelectTrigger className="h-8 w-[260px] rounded-none border-0 text-sm shadow-none focus:ring-0">
              <SelectValue placeholder="选择目标服务器" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">— 选择服务器 —</SelectItem>
              {serverAssets.map(asset => {
                const host = (asset.ext_config?.['host'] as string) ?? ''
                const port = asset.ext_config?.['port'] ?? ''
                return (
                  <SelectItem key={asset.id} value={String(asset.id)} textValue={`${asset.name} ${host}:${port}`}>
                    <span className="flex flex-col">
                      <span>{asset.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{`${host}:${port}`}</span>
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <form onSubmit={handleNavigate} className="flex min-w-[280px] flex-1 items-center gap-2">
          <Input
            value={pathInput}
            onChange={event => setPathInput(event.target.value)}
            placeholder="输入远端路径，例如 ~/deploy 或 /var/log"
            disabled={!selectedAssetId || loading}
            data-selectable
          />
          <Button type="submit" variant="outline" disabled={!selectedAssetId || loading}>
            跳转
          </Button>
        </form>

        <Button variant="outline" onClick={() => void loadDirectory(listResult?.home || '')} disabled={!selectedAssetId || loading}>
          主目录
        </Button>
        <Button variant="outline" onClick={() => void loadDirectory(listResult?.parent || listResult?.path || '')} disabled={!listResult?.parent || loading}>
          <ChevronUp className="h-3.5 w-3.5" />
          上级
        </Button>
        <Button variant="outline" onClick={() => void loadDirectory(listResult?.path || '')} disabled={!selectedAssetId || loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
        <Button variant="outline" onClick={() => setMkdirOpen(true)} disabled={!selectedAssetId || !!busyAction}>
          <FolderPlus className="h-3.5 w-3.5" />
          新建目录
        </Button>
        <Button onClick={handleChooseUpload} disabled={!selectedAssetId || !!busyAction}>
          <Upload className="h-3.5 w-3.5" />
          上传文件
        </Button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">{selectedAsset?.name ?? '未选择服务器'}</p>
              <p className="text-xs text-muted-foreground" data-selectable>{listResult?.path || '请选择服务器并加载目录'}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {selectedPaths.length > 0 && (
                <>
                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                    已选 {selectedPaths.length} 项
                  </span>
                  <span className="text-xs text-muted-foreground">
                    支持 Shift 连续选择，右键可直接执行批量操作
                  </span>
                  <Button variant="outline" size="sm" onClick={() => void handleDownloadSelected()} disabled={!selectedFileEntries.length || !!busyAction}>
                    <Download className="h-3.5 w-3.5" />
                    批量下载
                  </Button>
                  <Button variant="outline" size="sm" onClick={invertVisibleSelection} disabled={!!busyAction}>
                    反选
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedPaths([])} disabled={!!busyAction}>
                    清空选择
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => requestDeleteEntries(selectedEntries)} disabled={!!busyAction}>
                    <Trash2 className="h-3.5 w-3.5" />
                    批量删除
                  </Button>
                </>
              )}
              {listResult && (
                <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                  共 {listResult.entries.length} 项
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          ref={listViewportRef}
          className="min-h-0 flex-1 overflow-auto outline-none"
          tabIndex={selectedAssetId ? 0 : -1}
          onKeyDown={handleListKeyDown}
        >
          {!selectedAssetId ? (
            <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
              先选择一个服务器，再开始浏览远端文件。
            </div>
          ) : loading ? (
            <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
              目录加载中…
            </div>
          ) : sortedEntries.length ? (
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="sticky top-0 z-10 border-b border-border bg-muted/95 backdrop-blur">
                  <th className="w-12 px-4 py-3 font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border align-middle"
                      checked={allEntriesSelected}
                      onChange={event => toggleAllVisible(event.target.checked)}
                      aria-label="全选当前目录"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('name')}>
                      名称
                      <span className="text-[10px] text-muted-foreground">{sortKey === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium">类型</th>
                  <th className="px-4 py-3 font-medium">权限</th>
                  <th className="px-4 py-3 font-medium">
                    <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('size')}>
                      大小
                      <span className="text-[10px] text-muted-foreground">{sortKey === 'size' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('mod_time')}>
                      修改时间
                      <span className="text-[10px] text-muted-foreground">{sortKey === 'mod_time' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map(entry => (
                  <tr
                    key={entry.path}
                    ref={(node) => { rowRefs.current[entry.path] = node }}
                    className={`border-t border-border/70 transition-colors hover:bg-accent/30 ${selectedPaths.includes(entry.path) ? 'bg-primary/10' : ''} ${focusedEntryPath === entry.path ? 'bg-accent/50 ring-1 ring-inset ring-primary/35' : ''}`}
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey) {
                        toggleEntrySelection(entry, { range: event.shiftKey })
                      } else {
                        setFocusedEntryPath(entry.path)
                      }
                      closeContextMenu()
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      openEntryContextMenu(entry, event.clientX, event.clientY)
                    }}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border align-middle"
                        checked={selectedPaths.includes(entry.path)}
                        onChange={event => {
                          event.stopPropagation()
                          toggleEntrySelection(entry, { checked: event.target.checked })
                        }}
                        onClick={event => event.stopPropagation()}
                        aria-label={`选择 ${entry.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEntry(entry)}
                        className={`flex items-center gap-2 text-left ${entry.is_dir ? 'text-foreground hover:text-primary' : 'cursor-default text-foreground'}`}
                      >
                        {entry.is_dir ? (
                          <Folder className="h-4 w-4 text-amber-500" />
                        ) : (
                          <FileText className="h-4 w-4 text-sky-500" />
                        )}
                        <span className="font-medium" data-selectable>{entry.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.is_dir ? '目录' : '文件'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      <div>{entry.mode || '—'}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground/80">{formatOwnership(entry)}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{entry.is_dir ? '—' : formatFileSize(entry.size)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatTime(entry.mod_time)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {!entry.is_dir && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDownload(entry)}
                            loading={busyAction === `download:${entry.path}`}
                          >
                            {busyAction !== `download:${entry.path}` && <Download className="h-3.5 w-3.5" />}
                            下载
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenMove(entry)}
                          loading={busyAction === `move:${entry.path}`}
                        >
                          {busyAction !== `move:${entry.path}` && (entry.is_dir ? <Route className="h-3.5 w-3.5" /> : <PencilLine className="h-3.5 w-3.5" />)}
                          移动/重命名
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDelete(entry)}
                          loading={busyAction === `delete:${entry.path}`}
                        >
                          {busyAction !== `delete:${entry.path}` && <Trash2 className="h-3.5 w-3.5" />}
                          删除
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex h-[320px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Folder className="h-10 w-10 opacity-25" />
              <span>当前目录为空</span>
            </div>
          )}
        </div>

        {contextMenu.open && contextMenu.entry && (
          <div
            ref={contextMenuRef}
            className="absolute z-20 min-w-44 rounded-lg border border-border bg-popover/95 p-1 shadow-xl backdrop-blur"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={event => event.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
              onClick={() => {
                closeContextMenu()
                openEntry(contextMenu.entry as SFTPEntry)
              }}
            >
              {contextMenu.entry.is_dir ? <FolderOpen className="h-4 w-4 text-muted-foreground" /> : <Download className="h-4 w-4 text-muted-foreground" />}
              {contextMenu.entry.is_dir ? '打开目录' : '下载文件'}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
              onClick={() => handleOpenMove(contextMenu.entry as SFTPEntry)}
            >
              {contextMenu.entry.is_dir ? <Route className="h-4 w-4 text-muted-foreground" /> : <PencilLine className="h-4 w-4 text-muted-foreground" />}
              移动/重命名
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
              onClick={() => void handleCopyPath(contextMenu.entry as SFTPEntry)}
            >
              <Copy className="h-4 w-4 text-muted-foreground" />
              复制路径
            </button>
            {selectedPaths.length > 1 && selectedPaths.includes(contextMenu.entry.path) && (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
                  onClick={() => {
                    closeContextMenu()
                    void handleDownloadSelected()
                  }}
                  disabled={!selectedFileEntries.length}
                >
                  <Download className="h-4 w-4 text-muted-foreground" />
                  批量下载已选
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
                  onClick={() => {
                    requestDeleteEntries(selectedEntries)
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                  批量删除已选
                </button>
              </>
            )}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent"
              onClick={() => {
                requestDeleteEntries([contextMenu.entry as SFTPEntry])
              }}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              删除
            </button>
          </div>
        )}
      </div>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFilePicked} />

      <Modal
        open={mkdirOpen}
        onClose={() => {
          if (busyAction.startsWith('mkdir:')) return
          setMkdirOpen(false)
        }}
        title="新建远端目录"
        footer={(
          <>
            <Button variant="outline" onClick={() => setMkdirOpen(false)} disabled={busyAction.startsWith('mkdir:')}>
              取消
            </Button>
            <Button onClick={() => void handleCreateDirectory()} loading={busyAction.startsWith('mkdir:')}>
              创建目录
            </Button>
          </>
        )}
      >
        <FormField label="目录名" required>
          <Input
            value={newDirName}
            onChange={event => setNewDirName(event.target.value)}
            placeholder="例如 releases 或 logs/2026-03"
            disabled={busyAction.startsWith('mkdir:')}
          />
        </FormField>
      </Modal>

      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => {
        if (busyAction.startsWith('delete:') || busyAction === 'delete:selected') return
        setDeleteConfirm(current => ({ ...current, open }))
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirm.entries.length > 1 ? '批量删除确认' : `删除${deleteConfirm.entries[0]?.is_dir ? '目录' : '文件'}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.entries.length > 1
                ? `确定要删除已选中的 ${deleteConfirm.entries.length} 项吗？此操作不可撤销。`
                : `确定要删除 ${deleteConfirm.entries[0]?.is_dir ? '目录' : '文件'}「${deleteConfirm.entries[0]?.path || ''}」吗？此操作不可撤销。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyAction.startsWith('delete:') || busyAction === 'delete:selected'}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const entries = deleteConfirm.entries
                if (entries.length > 1) {
                  void handleDeleteSelected().finally(() => {
                    setDeleteConfirm({ open: false, entries: [] })
                  })
                } else if (entries[0]) {
                  void handleDelete(entries[0]).finally(() => {
                    setDeleteConfirm({ open: false, entries: [] })
                  })
                }
              }}
              disabled={busyAction.startsWith('delete:') || busyAction === 'delete:selected'}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={moveOverwriteConfirm.open} onOpenChange={(open) => {
        if (busyAction.startsWith('move:')) return
        setMoveOverwriteConfirm(current => ({ ...current, open }))
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>覆盖目标路径</AlertDialogTitle>
            <AlertDialogDescription>
              目标路径已存在：{moveOverwriteConfirm.targetPath}。确定要覆盖并继续移动吗？此操作可能替换现有文件或目录内容。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyAction.startsWith('move:')}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleMove(true)
              }}
              disabled={busyAction.startsWith('move:')}
            >
              覆盖并移动
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Modal
        open={moveOpen}
        onClose={() => {
          if (busyAction.startsWith('move:')) return
          setMoveOpen(false)
        }}
        title={moveSource?.is_dir ? '移动目录' : '移动 / 重命名文件'}
        footer={(
          <>
            <Button variant="outline" onClick={() => setMoveOpen(false)} disabled={busyAction.startsWith('move:')}>
              取消
            </Button>
            <Button onClick={() => void handleMove()} loading={busyAction.startsWith('move:')}>
              保存
            </Button>
          </>
        )}
      >
        <FormField label="当前路径">
          <Input value={moveSource?.path || ''} readOnly data-selectable />
        </FormField>
        <FormField label="目标路径" required>
          <Input
            value={moveTargetPath}
            onChange={event => setMoveTargetPath(event.target.value)}
            placeholder="例如 /opt/releases/app.tar.gz"
            disabled={busyAction.startsWith('move:')}
            data-selectable
          />
        </FormField>
        <p className="text-xs leading-5 text-muted-foreground">
          同目录下修改名称会直接完成重命名，改到其他目录则会执行移动。
        </p>
      </Modal>

      <Modal
        open={uploadOpen}
        onClose={() => {
          if (uploadInProgress) return
          resetUploadDialog()
        }}
        title="上传远端文件"
        footer={(
          <>
            <Button
              variant="outline"
              onClick={resetUploadDialog}
              disabled={uploadInProgress}
            >
              取消
            </Button>
            {uploadCompleted ? (
              <>
                {uploadHasFailures && (
                  <Button variant="outline" onClick={() => void handleRetryFailedUploads()} disabled={uploadInProgress}>
                    仅重试失败项
                  </Button>
                )}
                <Button onClick={resetUploadDialog}>完成</Button>
              </>
            ) : (
              <Button onClick={() => void handleConfirmUpload()} loading={uploadInProgress} disabled={!uploadFiles.length || uploadInProgress}>
                开始上传
              </Button>
            )}
          </>
        )}
      >
        <div className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            className={`rounded-xl border border-dashed p-6 text-center transition-colors ${uploadDragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:bg-accent/30'}`}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault()
              setUploadDragOver(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setUploadDragOver(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
              setUploadDragOver(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setUploadDragOver(false)
              handlePickedUploadFiles(event.dataTransfer.files)
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <UploadCloud className="h-10 w-10 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">拖拽文件到这里上传</p>
                <p className="text-xs text-muted-foreground">或点击这里，通过系统文件选择器一次挑选多个文件</p>
              </div>
            </div>
          </div>

          <FormField label="目标目录">
            <Input value={uploadTargetSummary || (listResult?.path || '/')} readOnly data-selectable />
          </FormField>

          {uploadSummary && (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium text-foreground">总进度</p>
                  <p className="text-xs text-muted-foreground">{uploadSummary.stage}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-muted-foreground">{uploadSummary.percent != null ? `${uploadSummary.percent}%` : '处理中'}</p>
                  <p className="font-mono text-xs text-muted-foreground">{formatFileSize(uploadSummary.transferredBytes)} / {formatFileSize(uploadSummary.totalBytes || 0)}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{uploadSummary.completedFiles}/{uploadSummary.totalFiles} 个文件</span>
                <span className="font-mono">速度: {formatSpeed(uploadSummary.speedBps)}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/80">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${uploadSummary.percent ?? 0}%` }} />
              </div>
            </div>
          )}

          {uploadFiles.length ? (
            <div className="max-h-56 space-y-2 overflow-auto rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm">
              {uploadProgressItems.map(item => (
                <div key={item.key} className="space-y-2 rounded-md bg-background/70 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground" data-selectable>{item.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">大小: {formatFileSize(item.size)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs text-muted-foreground">{item.percent != null ? `${item.percent}%` : '0%'}</p>
                      <p className="text-xs text-muted-foreground">{item.status === 'error' ? '失败' : item.status === 'success' ? '完成' : item.stage}</p>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${item.status === 'error' ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${item.percent ?? 0}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 font-mono text-xs text-muted-foreground">
                    <span>{formatFileSize(item.loaded)} / {formatFileSize(item.total)}</span>
                    <span>速度: {formatSpeed(item.speedBps)}</span>
                  </div>
                  {item.error && <p className="text-xs text-destructive">{item.error}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">尚未选择文件。</p>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-foreground">覆盖同名文件</p>
              <p className="text-xs text-muted-foreground">开启后，若目标已存在，将直接覆盖远端同名文件。</p>
            </div>
            <Switch checked={uploadOverwrite} onCheckedChange={setUploadOverwrite} disabled={uploadInProgress} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
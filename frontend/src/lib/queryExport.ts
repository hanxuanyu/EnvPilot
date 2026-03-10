import * as XLSX from 'xlsx'
import { IS_SERVER_MODE } from '@/lib/apiClient'
import { saveDesktopExportFile } from '@/services/backendService'
import type { QueryResult } from '@/types/connector'

type QueryExportFormat = 'csv' | 'json' | 'xlsx'

function triggerBrowserDownload(fileName: string, data: Uint8Array, mimeType: string) {
  const blobData = new Uint8Array(data.byteLength)
  blobData.set(data)
  const blob = new Blob([blobData], { type: mimeType })
  const downloadURL = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = downloadURL
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(downloadURL), 1000)
}

function encodeUTF8(content: string) {
  return new TextEncoder().encode(content)
}

function normalizeExportRows(result: QueryResult) {
  if (result.columns.length > 0) {
    return result.rows.map((row) => {
      const normalizedRow: Record<string, unknown> = {}
      result.columns.forEach((column) => {
        normalizedRow[column.name] = row[column.name]
      })
      return normalizedRow
    })
  }

  return [{
    summary: result.summary || 'SQL 执行成功',
    affected: result.affected,
    duration_ms: result.duration_ms,
  }]
}

function buildCSVContent(result: QueryResult) {
  const rows = normalizeExportRows(result)
  if (rows.length === 0) return ''

  const headers = Object.keys(rows[0])
  const escapeCell = (value: unknown) => {
    const text = value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value)
    if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
    return text
  }

  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
  ].join('\n')
}

async function persistFile(fileName: string, data: Uint8Array, mimeType: string, filterDisplayName: string, filterPattern: string) {
  if (IS_SERVER_MODE) {
    triggerBrowserDownload(fileName, data, mimeType)
    return null
  }

  return saveDesktopExportFile({
    filename: fileName,
    data,
    title: '导出查询结果',
    filterDisplayName,
    filterPattern,
  })
}

export async function exportQueryResult(result: QueryResult, baseFileName: string, format: QueryExportFormat) {
  const safeBaseFileName = baseFileName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-_\u4e00-\u9fa5]/g, '') || 'query-result'

  if (format === 'json') {
    const json = JSON.stringify({
      summary: result.summary,
      affected: result.affected,
      duration_ms: result.duration_ms,
      columns: result.columns,
      rows: result.rows,
    }, null, 2)
    return persistFile(`${safeBaseFileName}.json`, encodeUTF8(json), 'application/json;charset=utf-8', 'JSON 文件 (*.json)', '*.json')
  }

  if (format === 'csv') {
    const csv = buildCSVContent(result)
    return persistFile(`${safeBaseFileName}.csv`, encodeUTF8(csv), 'text/csv;charset=utf-8', 'CSV 文件 (*.csv)', '*.csv')
  }

  const worksheet = XLSX.utils.json_to_sheet(normalizeExportRows(result))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'result')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return persistFile(`${safeBaseFileName}.xlsx`, new Uint8Array(buffer), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Excel 文件 (*.xlsx)', '*.xlsx')
}
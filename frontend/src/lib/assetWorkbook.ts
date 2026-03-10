import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'
import { IS_SERVER_MODE } from '@/lib/apiClient'
import { saveDesktopExportFile } from '@/services/backendService'
import type { Asset, AssetCategory, Credential, Environment, PluginDef } from '@/types/asset'
import {
  ASSET_STATUS_LABELS,
  CATEGORY_LABELS,
  CREDENTIAL_TYPE_LABELS,
  getAssetAddress,
} from '@/types/asset'

export interface AssetImportRow {
  rowNumber: number
  environmentName: string
  groupName: string
  assetName: string
  category: AssetCategory
  pluginType: string
  description: string
  tags: string[]
  credentialName: string
  dnsEnabled: boolean
  dnsDomain: string
  dnsTTL: number
  extConfig: Record<string, unknown>
}

export type AssetExportMode = 'current' | 'selected-environment' | 'environment' | 'middleware'

interface WorkbookAssetExportOptions {
  fileName: string
  assets: Asset[]
  credentials?: Credential[]
  secretsByCredentialId?: Record<number, string>
  environments?: Environment[]
  plugins?: PluginDef[]
  includeSensitive?: boolean
  exportMode?: AssetExportMode
  selectedEnvironmentId?: number
  selectedEnvironmentName?: string
  sheetName?: string
}

interface ExportColumn {
  key: string
  label: string
  secret?: boolean
}

interface SheetDefinition {
  name: string
  title: string
  subtitle: string
  headers: string[]
  rows: Array<Record<string, string | number | boolean>>
  sensitiveHeaders?: string[]
  environmentBanding?: boolean
}

const IMPORT_TEMPLATE_HEADERS = [
  'environment_name',
  'group_name',
  'asset_name',
  'category',
  'plugin_type',
  'description',
  'tags',
  'credential_name',
  'dns_enabled',
  'dns_domain',
  'dns_ttl',
  'ext_config_json',
]

const IMPORT_TEMPLATE_SAMPLE = {
  environment_name: '生产环境',
  group_name: 'Web层',
  asset_name: 'prod-nginx-01',
  category: 'server',
  plugin_type: 'linux_server',
  description: '生产入口节点',
  tags: 'web,nginx,prod',
  credential_name: '生产 SSH 凭据',
  dns_enabled: 'true',
  dns_domain: 'prod-nginx-01.example.com',
  dns_ttl: '300',
  ext_config_json: '{"host":"10.0.0.10","port":22}',
}

const PREFERRED_PLUGIN_FIELD_ORDER = [
  'host',
  'port',
  'database',
  'schema',
  'name_server',
  'brokers',
  'virtual_host',
  'cluster',
  'namespace',
  'username',
  'password',
  'token',
  'secret',
]

const STATUS_TONES: Record<string, string> = {
  online: 'E8F7ED',
  offline: 'FDECEC',
  warning: 'FFF4E5',
  unknown: 'EEF2F7',
}

const THEME = {
  titleFill: '16324F',
  titleFont: 'F8FAFC',
  subtitleFill: 'EEF4FA',
  subtitleFont: '486581',
  headerFill: '1F4E79',
  headerFont: 'FFFFFF',
  border: 'D7E2F0',
  zebra: 'F8FBFF',
  envBand: 'F3F8FC',
  sensitiveFill: 'FFF4E5',
}

function formatDateStamp(date = new Date()) {
  const pad = (value: number) => value.toString().padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

function asString(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function parseBool(value: unknown) {
  const normalized = asString(value).toLowerCase()
  return ['1', 'true', 'yes', 'y', '是', '启用'].includes(normalized)
}

function parseTags(value: unknown) {
  return asString(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseExtConfig(value: unknown, rowNumber: number) {
  const raw = asString(value)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('ext_config_json 必须是 JSON 对象')
    }
    return parsed as Record<string, unknown>
  } catch (error: any) {
    throw new Error(`第 ${rowNumber} 行 ext_config_json 解析失败: ${error.message}`)
  }
}

function getCredentialMap(credentials: Credential[]) {
  return credentials.reduce<Record<number, Credential>>((acc, credential) => {
    acc[credential.id] = credential
    return acc
  }, {})
}

function getPluginMap(plugins: PluginDef[]) {
  return plugins.reduce<Record<string, PluginDef>>((acc, plugin) => {
    acc[plugin.type_id] = plugin
    return acc
  }, {})
}

function serializeCellValue(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.join(', ')
  return JSON.stringify(value)
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase()
  return ['password', 'token', 'secret', 'secret_key', 'private_key', 'access_key'].some((word) => normalized.includes(word))
}

function maskIfNeeded(value: unknown, secret: boolean, includeSensitive: boolean) {
  if (!secret || includeSensitive) return serializeCellValue(value)
  if (value === null || value === undefined || value === '') return ''
  return '******'
}

function sortPluginColumns(columns: ExportColumn[]) {
  return [...columns].sort((left, right) => {
    const leftIndex = PREFERRED_PLUGIN_FIELD_ORDER.indexOf(left.key)
    const rightIndex = PREFERRED_PLUGIN_FIELD_ORDER.indexOf(right.key)
    if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex
    if (leftIndex >= 0) return -1
    if (rightIndex >= 0) return 1
    return left.label.localeCompare(right.label, 'zh-CN')
  })
}

function getPluginColumns(plugin?: PluginDef): ExportColumn[] {
  if (!plugin) return []
  return sortPluginColumns(plugin.config_schema.map((field) => ({
    key: field.key,
    label: field.label || field.key,
    secret: field.secret || isSensitiveKey(field.key),
  })))
}

function formatConnectionSummary(asset: Asset, plugin: PluginDef | undefined, includeSensitive: boolean) {
  const config = asset.ext_config ?? {}
  const columns = getPluginColumns(plugin)
  if (columns.length === 0) {
    return Object.entries(config)
      .map(([key, value]) => `${key}=${maskIfNeeded(value, isSensitiveKey(key), includeSensitive)}`)
      .filter((item) => !item.endsWith('='))
      .join('；')
  }
  return columns
    .map((column) => {
      const value = config[column.key]
      if (value === null || value === undefined || value === '') return ''
      return `${column.label}=${maskIfNeeded(value, !!column.secret, includeSensitive)}`
    })
    .filter(Boolean)
    .join('；')
}

function createBaseRow(
  asset: Asset,
  credentialMap: Record<number, Credential>,
  secretsByCredentialId: Record<number, string>,
  includeSensitive: boolean,
  plugin: PluginDef | undefined,
) {
  const credential = asset.credential_id ? credentialMap[asset.credential_id] ?? asset.credential : asset.credential
  const row: Record<string, string | number | boolean> = {
    环境: asset.environment?.name ?? '未命名环境',
    分组: asset.group?.name ?? '未分组',
    资产名称: asset.name,
    类别: CATEGORY_LABELS[asset.category] ?? asset.category,
    资产类型: plugin?.display_name ?? asset.plugin_type,
    插件类型: asset.plugin_type,
    连接地址: getAssetAddress(asset),
    连接信息: formatConnectionSummary(asset, plugin, includeSensitive),
    状态: ASSET_STATUS_LABELS[asset.status] ?? asset.status,
    标签: asset.tags?.join(', ') ?? '',
    描述: asset.description ?? '',
    凭据名称: credential?.name ?? '',
    凭据类型: credential ? CREDENTIAL_TYPE_LABELS[credential.type] ?? credential.type : '',
    更新时间: asset.updated_at ? new Date(asset.updated_at).toLocaleString('zh-CN') : '',
  }

  if (includeSensitive) {
    row['登录用户名'] = credential?.username ?? ''
    row['密码或密钥'] = credential?.id ? secretsByCredentialId[credential.id] ?? '' : ''
  }

  return row
}

function safeSheetName(name: string, fallbackIndex: number, usedNames: Set<string>) {
  const base = (name || `Sheet${fallbackIndex + 1}`)
    .replace(/[\\/?*\[\]:]/g, '-')
    .slice(0, 31)
    || `Sheet${fallbackIndex + 1}`

  if (!usedNames.has(base)) {
    usedNames.add(base)
    return base
  }

  for (let index = 1; index < 100; index += 1) {
    const suffix = `-${index}`
    const candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate)
      return candidate
    }
  }

  return `Sheet${fallbackIndex + 1}`
}

function sortAssetsByEnvironment(assets: Asset[], environments: Environment[]) {
  const environmentOrder = new Map(environments.map((environment, index) => [environment.id, index]))
  return [...assets].sort((left, right) => {
    const leftOrder = environmentOrder.get(left.environment_id) ?? Number.MAX_SAFE_INTEGER
    const rightOrder = environmentOrder.get(right.environment_id) ?? Number.MAX_SAFE_INTEGER
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return left.name.localeCompare(right.name, 'zh-CN')
  })
}

function toUint8Array(data: Uint8Array | ArrayBuffer) {
  if (data instanceof Uint8Array) return data
  return new Uint8Array(data)
}

function triggerBrowserDownload(fileName: string, data: Uint8Array, mimeType: string) {
  const blobData = new Uint8Array(data.byteLength)
  blobData.set(data)
  const blob = new Blob([blobData], { type: mimeType })
  const downloadURL = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = downloadURL
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(downloadURL), 1000)
}

async function persistBinary(data: Uint8Array, fileName: string, title: string) {
  if (IS_SERVER_MODE) {
    triggerBrowserDownload(
      fileName,
      data,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    return true
  }

  const savedPath = await saveDesktopExportFile({
    filename: fileName,
    data,
    title,
    filterDisplayName: 'Excel 文件 (*.xlsx)',
    filterPattern: '*.xlsx',
  })
  return !!savedPath
}

function applyCellBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: THEME.border } },
    left: { style: 'thin', color: { argb: THEME.border } },
    bottom: { style: 'thin', color: { argb: THEME.border } },
    right: { style: 'thin', color: { argb: THEME.border } },
  }
}

function applyWorksheetStyles(worksheet: ExcelJS.Worksheet, definition: SheetDefinition) {
  const columnCount = Math.max(definition.headers.length, 1)

  worksheet.mergeCells(1, 1, 1, columnCount)
  worksheet.getCell(1, 1).value = definition.title
  worksheet.getCell(1, 1).font = { size: 16, bold: true, color: { argb: THEME.titleFont } }
  worksheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.titleFill } }
  worksheet.getCell(1, 1).alignment = { vertical: 'middle', horizontal: 'left' }
  worksheet.getRow(1).height = 26

  worksheet.mergeCells(2, 1, 2, columnCount)
  worksheet.getCell(2, 1).value = definition.subtitle
  worksheet.getCell(2, 1).font = { size: 10, color: { argb: THEME.subtitleFont } }
  worksheet.getCell(2, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.subtitleFill } }
  worksheet.getCell(2, 1).alignment = { vertical: 'middle', horizontal: 'left' }
  worksheet.getRow(2).height = 18

  const headerRow = worksheet.getRow(4)
  definition.headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = header
    cell.font = { bold: true, color: { argb: THEME.headerFont } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.headerFill } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    applyCellBorder(cell)
  })
  headerRow.height = 24

  const sensitiveHeaderSet = new Set(definition.sensitiveHeaders ?? [])
  const statusIndex = definition.headers.indexOf('状态')
  const environmentIndex = definition.headers.indexOf('环境')

  definition.rows.forEach((row, rowIndex) => {
    const excelRow = worksheet.getRow(rowIndex + 5)
    definition.headers.forEach((header, columnIndex) => {
      const cell = excelRow.getCell(columnIndex + 1)
      cell.value = row[header] ?? ''
      cell.alignment = {
        vertical: 'top',
        horizontal: columnIndex === statusIndex ? 'center' : 'left',
        wrapText: true,
      }
      applyCellBorder(cell)

      if (rowIndex % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.zebra } }
      }
      if (definition.environmentBanding && columnIndex === environmentIndex) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.envBand } }
        cell.font = { bold: true, color: { argb: '36536B' } }
      }
      if (sensitiveHeaderSet.has(header)) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.sensitiveFill } }
      }
      if (columnIndex === statusIndex) {
        const statusValue = Object.entries(ASSET_STATUS_LABELS).find(([, label]) => label === row[header])?.[0]
        const tone = statusValue ? STATUS_TONES[statusValue] : undefined
        if (tone) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tone } }
          cell.font = { bold: true }
        }
      }
    })
    excelRow.height = 22
  })

  definition.headers.forEach((header, index) => {
    const maxLength = Math.min(
      36,
      Math.max(
        header.length + 4,
        ...definition.rows.map((row) => asString(row[header]).length + 2),
      ),
    )
    worksheet.getColumn(index + 1).width = Math.max(maxLength, header === '描述' || header === '连接信息' ? 24 : 12)
  })

  worksheet.views = [{ state: 'frozen', ySplit: 4 }]
  worksheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: columnCount },
  }
}

function addStyledSheet(workbook: ExcelJS.Workbook, definition: SheetDefinition) {
  const worksheet = workbook.addWorksheet(definition.name)
  applyWorksheetStyles(worksheet, definition)
}

function buildSummaryRows(assets: Asset[], environments: Environment[]) {
  if (environments.length === 0) {
    return [{ 环境: '全部环境', 资源数量: assets.length, 中间件数量: assets.filter((asset) => asset.category !== 'server').length, 描述: '' }]
  }

  return environments.map((environment) => {
    const environmentAssets = assets.filter((asset) => asset.environment_id === environment.id)
    return {
      环境: environment.name,
      描述: environment.description ?? '',
      资源数量: environmentAssets.length,
      中间件数量: environmentAssets.filter((asset) => asset.category !== 'server').length,
    }
  })
}

function makeCurrentRows(
  assets: Asset[],
  credentialMap: Record<number, Credential>,
  secretsByCredentialId: Record<number, string>,
  includeSensitive: boolean,
  pluginMap: Record<string, PluginDef>,
) {
  return assets.map((asset) => createBaseRow(asset, credentialMap, secretsByCredentialId, includeSensitive, pluginMap[asset.plugin_type]))
}

function makeMiddlewareRows(
  assets: Asset[],
  plugin: PluginDef | undefined,
  credentialMap: Record<number, Credential>,
  secretsByCredentialId: Record<number, string>,
  includeSensitive: boolean,
) {
  const pluginColumns = getPluginColumns(plugin)
  return assets.map((asset) => {
    const credential = asset.credential_id ? credentialMap[asset.credential_id] ?? asset.credential : asset.credential
    const row: Record<string, string | number | boolean> = {
      环境: asset.environment?.name ?? '未命名环境',
      分组: asset.group?.name ?? '未分组',
      资产名称: asset.name,
      连接地址: getAssetAddress(asset),
      状态: ASSET_STATUS_LABELS[asset.status] ?? asset.status,
      标签: asset.tags?.join(', ') ?? '',
      描述: asset.description ?? '',
      凭据名称: credential?.name ?? '',
      凭据类型: credential ? CREDENTIAL_TYPE_LABELS[credential.type] ?? credential.type : '',
      更新时间: asset.updated_at ? new Date(asset.updated_at).toLocaleString('zh-CN') : '',
    }

    pluginColumns.forEach((column) => {
      row[column.label] = maskIfNeeded(asset.ext_config?.[column.key], !!column.secret, includeSensitive)
    })

    if (includeSensitive) {
      row['登录用户名'] = credential?.username ?? ''
      row['密码或密钥'] = credential?.id ? secretsByCredentialId[credential.id] ?? '' : ''
    }

    return row
  })
}

function buildWorkbookDefinitions({
  assets,
  environments,
  credentials,
  secretsByCredentialId,
  plugins,
  includeSensitive,
  exportMode,
  selectedEnvironmentId,
  selectedEnvironmentName,
  sheetName,
}: Omit<WorkbookAssetExportOptions, 'fileName'> & {
  credentials: Credential[]
  secretsByCredentialId: Record<number, string>
  environments: Environment[]
  plugins: PluginDef[]
  includeSensitive: boolean
  exportMode: AssetExportMode
  sheetName: string
}) {
  const credentialMap = getCredentialMap(credentials)
  const pluginMap = getPluginMap(plugins)
  const definitions: SheetDefinition[] = []

  definitions.push({
    name: '总览',
    title: '资源导出总览',
    subtitle: `导出时间：${new Date().toLocaleString('zh-CN')}｜导出模式：${exportMode}`,
    headers: ['环境', '描述', '资源数量', '中间件数量'],
    rows: buildSummaryRows(assets, environments),
  })

  if (exportMode === 'current') {
    const rows = makeCurrentRows(assets, credentialMap, secretsByCredentialId, includeSensitive, pluginMap)
    definitions.push({
      name: sheetName,
      title: '当前资源列表',
      subtitle: '基于当前资产列表筛选条件导出',
      headers: Object.keys(rows[0] ?? { 资产名称: '' }),
      rows,
      sensitiveHeaders: includeSensitive ? ['登录用户名', '密码或密钥'] : [],
      environmentBanding: true,
    })
    return definitions
  }

  if (exportMode === 'selected-environment') {
    const filteredAssets = selectedEnvironmentId
      ? assets.filter((asset) => asset.environment_id === selectedEnvironmentId)
      : assets
    const rows = makeCurrentRows(filteredAssets, credentialMap, secretsByCredentialId, includeSensitive, pluginMap)
    definitions.push({
      name: safeSheetName(selectedEnvironmentName || '当前环境', 0, new Set(['总览'])),
      title: `当前环境资源清单${selectedEnvironmentName ? `｜${selectedEnvironmentName}` : ''}`,
      subtitle: '仅导出当前选中环境的资源',
      headers: Object.keys(rows[0] ?? { 资产名称: '' }),
      rows,
      sensitiveHeaders: includeSensitive ? ['登录用户名', '密码或密钥'] : [],
      environmentBanding: true,
    })
    return definitions
  }

  if (exportMode === 'environment') {
    const usedNames = new Set<string>(['总览'])
    const targetEnvironments = environments.length > 0
      ? environments
      : Array.from(new Map(assets.map((asset) => [asset.environment_id, asset.environment]).filter((item) => item[1]).map(([id, env]) => [id, env as Environment])).values())

    targetEnvironments.forEach((environment, index) => {
      const rows = makeCurrentRows(
        assets.filter((asset) => asset.environment_id === environment.id),
        credentialMap,
        secretsByCredentialId,
        includeSensitive,
        pluginMap,
      )
      definitions.push({
        name: safeSheetName(environment.name, index, usedNames),
        title: `环境资源清单｜${environment.name}`,
        subtitle: environment.description || '按环境归档导出',
        headers: Object.keys(rows[0] ?? { 资产名称: '' }),
        rows,
        sensitiveHeaders: includeSensitive ? ['登录用户名', '密码或密钥'] : [],
      })
    })
    return definitions
  }

  const usedNames = new Set<string>(['总览'])
  const middlewareAssets = sortAssetsByEnvironment(
    assets.filter((asset) => asset.category !== 'server'),
    environments,
  )
  const grouped = new Map<string, Asset[]>()

  middlewareAssets.forEach((asset) => {
    const list = grouped.get(asset.plugin_type) ?? []
    list.push(asset)
    grouped.set(asset.plugin_type, list)
  })

  Array.from(grouped.entries()).forEach(([pluginType, groupedAssets], index) => {
    const plugin = plugins.find((item) => item.type_id === pluginType)
    const rows = makeMiddlewareRows(groupedAssets, plugin, credentialMap, secretsByCredentialId, includeSensitive)
    definitions.push({
      name: safeSheetName(plugin?.display_name ?? pluginType, index, usedNames),
      title: `中间件资源清单｜${plugin?.display_name ?? pluginType}`,
      subtitle: '按环境顺序展示，并拆分连接字段列',
      headers: Object.keys(rows[0] ?? { 环境: '', 资产名称: '' }),
      rows,
      sensitiveHeaders: includeSensitive
        ? ['登录用户名', '密码或密钥', ...getPluginColumns(plugin).filter((column) => column.secret).map((column) => column.label)]
        : [],
      environmentBanding: true,
    })
  })

  return definitions
}

async function persistWorkbook(workbook: ExcelJS.Workbook, fileName: string, title: string) {
  const buffer = await workbook.xlsx.writeBuffer()
  return persistBinary(toUint8Array(buffer), fileName, title)
}

export function makeWorkbookFileName(prefix: string) {
  return `${prefix}-${formatDateStamp()}.xlsx`
}

export async function downloadAssetImportTemplate() {
  const workbook = XLSX.utils.book_new()
  const templateSheet = XLSX.utils.json_to_sheet([IMPORT_TEMPLATE_SAMPLE], {
    header: IMPORT_TEMPLATE_HEADERS,
  })
  const guideSheet = XLSX.utils.aoa_to_sheet([
    ['字段', '说明'],
    ['environment_name', '必填，环境名称，需与系统中的环境完全一致'],
    ['group_name', '可选，分组名称；为空则导入为未分组资源'],
    ['asset_name', '必填，资产显示名称'],
    ['category', '必填，可选值：server / database / cache / mq / other'],
    ['plugin_type', '必填，插件类型，例如 linux_server / mysql / redis'],
    ['description', '可选，备注说明'],
    ['tags', '可选，多个标签用英文逗号分隔'],
    ['credential_name', '可选，凭据名称；需与系统中的凭据完全一致'],
    ['dns_enabled', '可选，true/false'],
    ['dns_domain', '可选，启用 DNS 时填写'],
    ['dns_ttl', '可选，默认 300'],
    ['ext_config_json', '必填，插件连接配置，填写 JSON 对象，例如 {"host":"10.0.0.10","port":22}'],
  ])

  XLSX.utils.book_append_sheet(workbook, templateSheet, 'assets_template')
  XLSX.utils.book_append_sheet(workbook, guideSheet, '说明')
  const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return persistBinary(new Uint8Array(data), makeWorkbookFileName('资产导入模板'), '保存资源导入模板')
}

export async function parseAssetImportFile(file: File): Promise<AssetImportRow[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames.find((name) => name !== '说明') ?? workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('导入文件中没有可读取的数据工作表')
  }

  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  return rows
    .map((row, index) => {
      const rowNumber = index + 2
      const environmentName = asString(row.environment_name)
      const assetName = asString(row.asset_name)
      const category = asString(row.category).toLowerCase() as AssetCategory
      const pluginType = asString(row.plugin_type)
      const extConfig = parseExtConfig(row.ext_config_json, rowNumber)

      if (!environmentName || !assetName || !category || !pluginType) {
        if (Object.values(row).every((value) => !asString(value))) {
          return null
        }
        throw new Error(`第 ${rowNumber} 行缺少必填字段`)
      }

      return {
        rowNumber,
        environmentName,
        groupName: asString(row.group_name),
        assetName,
        category,
        pluginType,
        description: asString(row.description),
        tags: parseTags(row.tags),
        credentialName: asString(row.credential_name),
        dnsEnabled: parseBool(row.dns_enabled),
        dnsDomain: asString(row.dns_domain),
        dnsTTL: Number(asString(row.dns_ttl) || '300') || 300,
        extConfig,
      } satisfies AssetImportRow
    })
    .filter((row): row is AssetImportRow => row !== null)
}

export async function downloadAssetsWorkbook({
  fileName,
  assets,
  credentials = [],
  secretsByCredentialId = {},
  environments = [],
  plugins = [],
  includeSensitive = false,
  exportMode = 'current',
  selectedEnvironmentId,
  selectedEnvironmentName,
  sheetName = '资产列表',
}: WorkbookAssetExportOptions) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'EnvPilot'
  workbook.created = new Date()
  workbook.modified = new Date()

  const definitions = buildWorkbookDefinitions({
    assets,
    credentials,
    secretsByCredentialId,
    environments,
    plugins,
    includeSensitive,
    exportMode,
    selectedEnvironmentId,
    selectedEnvironmentName,
    sheetName,
  })

  definitions.forEach((definition) => addStyledSheet(workbook, definition))

  const title = exportMode === 'middleware'
    ? '保存中间件资源清单'
    : exportMode === 'environment'
      ? '保存环境资源清单'
      : exportMode === 'selected-environment'
        ? '保存当前环境资源清单'
        : '保存资源清单'

  return persistWorkbook(workbook, fileName, title)
}
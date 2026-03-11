export interface AuditLog {
  id: number
  module: string
  action: string
  resource_type: string
  resource_id?: number
  resource_name?: string
  plugin_type?: string
  operator?: string
  success: boolean
  detail?: string
  request_data?: string
  result_data?: string
  created_at: string
}

export interface AuditListResult {
  items: AuditLog[]
  total: number
}

export interface AuditCleanupResult {
  trigger: string
  retention_days: number
  max_records: number
  deleted_by_age: number
  deleted_by_count: number
  deleted_total: number
  total_before: number
  total_after: number
  recorded: boolean
  cleaned_at: string
}

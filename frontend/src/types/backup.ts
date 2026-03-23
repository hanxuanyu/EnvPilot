export interface BackupSummary {
  system_settings: number
  environments: number
  groups: number
  credentials: number
  assets: number
  dns_records: number
  dns_query_stats: number
  health_snapshots: number
  executions: number
  audit_logs: number
  config_snapshots: number
  security_files: string[]
  has_master_password: boolean
}

export interface BackupManifest {
  format: string
  exported_at: string
  app_name: string
  app_version: string
  config_path: string
  bundle_file_name: string
  description: string
  included_files: string[]
  summary: BackupSummary
}

export interface ExportBackupResult {
  filename: string
  data_base64: string
  manifest: BackupManifest
}

export interface AnalyzeImportResult {
  manifest: BackupManifest
  current: BackupSummary
  requires_force: boolean
}

export interface ImportBackupResult {
  manifest: BackupManifest
  current: BackupSummary
  restart_required: boolean
  warnings: string[]
}

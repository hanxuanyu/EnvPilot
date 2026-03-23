export interface AppSection {
  name: string
  data_dir: string
  log_dir: string
}

export interface LogSection {
  level: string
  filename: string
  max_size: number
  max_backups: number
  max_age: number
  compress: boolean
}

export interface SQLiteDatabaseSection {
  filename: string
}

export interface MySQLDatabaseSection {
  host: string
  port: number
  username: string
  password: string
  dbname: string
  params: string
}

export interface DatabasePoolSection {
  max_idle_conns: number
  max_open_conns: number
}

export interface DatabaseSection {
  driver: string
  sqlite: SQLiteDatabaseSection
  mysql: MySQLDatabaseSection
  pool: DatabasePoolSection
}

export interface SecuritySection {
  master_password_enabled: boolean
  salt_file: string
  dangerous_commands: string[]
}

export interface DNSSection {
  enabled: boolean
  listen_addr: string
  upstream: string
  default_ttl: number
}

export interface HealthSection {
  check_interval: number
  timeout: number
  auto_check: boolean
}

export interface AuditSection {
  auto_cleanup: boolean
  retention_days: number
  max_records: number
  cleanup_interval_hours: number
}

export interface AppConfig {
  app: AppSection
  log: LogSection
  database: DatabaseSection
  security: SecuritySection
  dns: DNSSection
  health: HealthSection
  audit: AuditSection
}

export interface HotReloadResult {
  applied: string[]
  restart_required: string[]
  messages: string[]
}

export interface ConfigSnapshot {
  id: number
  version: number
  content: string
  comment?: string
  created_by?: string
  created_at: string
}

export interface CurrentConfigResult {
  config: AppConfig
  yaml: string
  config_path: string
  requires_restart: boolean
  hot_reload: HotReloadResult
  latest_snapshot?: ConfigSnapshot
}

export interface ConfigSnapshotListResult {
  items: ConfigSnapshot[]
  total: number
}

export interface ConfigSnapshotDetailResult {
  snapshot: ConfigSnapshot
}

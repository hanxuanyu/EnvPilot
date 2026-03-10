export interface QueryColumn {
  name: string
  type: string
}

export interface DatabaseCatalogItem {
  name: string
  tables: string[]
  error?: string
}

export interface DatabaseCatalog {
  default_database?: string
  schema?: string
  databases: DatabaseCatalogItem[]
}

export interface TableColumn {
  name: string
  type: string
  nullable: boolean
  default_value?: string
  key?: string
  extra?: string
  comment?: string
}

export interface TableIndex {
  name: string
  columns?: string[]
  unique: boolean
  primary: boolean
  method?: string
}

export interface TableDetail {
  database?: string
  schema?: string
  table: string
  columns: TableColumn[]
  indexes?: TableIndex[]
  create_sql?: string
}

export type ConnectorTabKey = 'database' | 'cache' | 'mq'

export interface QueryResult {
  columns: QueryColumn[]
  rows: Array<Record<string, unknown>>
  affected: number
  duration_ms: number
  summary?: string
}

export interface CommandResult {
  command: string
  result: unknown
}

export interface MQMessage {
  topic?: string
  tag?: string
  exchange?: string
  routing_key?: string
  key?: string
  headers?: Record<string, string>
  body: string
}

export interface SendResult {
  success: boolean
  message_id?: string
  detail?: string
}
export interface QueryColumn {
  name: string
  type: string
}

export interface QueryResult {
  columns: QueryColumn[]
  rows: Array<Record<string, unknown>>
  affected: number
  duration_ms: number
}

export interface CommandResult {
  command: string
  result: unknown
}
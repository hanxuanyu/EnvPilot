export interface QueryColumn {
  name: string
  type: string
}

export type ConnectorTabKey = 'database' | 'cache' | 'mq'

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
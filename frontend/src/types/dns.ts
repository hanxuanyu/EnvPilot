import type { Asset, Environment } from '@/types/asset'

export type DNSRecordType = 'A' | 'CNAME'
export type DNSMatchMode = 'exact' | 'wildcard' | 'regex'

export interface DNSRecord {
	id: number
	environment_id: number
	asset_id?: number
	domain: string
	record_type: DNSRecordType
	match_mode: DNSMatchMode
	value: string
	ttl: number
	enabled: boolean
	created_at: string
	updated_at: string
	environment?: Environment
	asset?: Asset
}

export interface ListDNSRecordsReq {
	environment_id?: number
	keyword?: string
	enabled?: boolean
}

export interface CreateDNSRecordReq {
	environment_id: number
	asset_id?: number
	domain: string
	record_type: DNSRecordType
	match_mode: DNSMatchMode
	value: string
	ttl: number
	enabled: boolean
}

export interface UpdateDNSRecordReq {
	id: number
	environment_id: number
	asset_id?: number
	domain: string
	record_type: DNSRecordType
	match_mode: DNSMatchMode
	value: string
	ttl: number
	enabled: boolean
}

export interface DNSQuerySummary {
	id: number
	domain: string
	question_type: string
	source: string
	environment_id?: number
	total_count: number
	last_response_code: string
	last_answer_summary: string
	last_hit_local: boolean
	last_upstream_used: boolean
	last_client_ip: string
	last_duration_ms: number
	last_queried_at: string
	created_at: string
	updated_at: string
	environment?: Environment
}

export interface ListDNSQueryLogsReq {
	environment_id?: number
	keyword?: string
	source?: string
	limit?: number
	offset?: number
}

export interface ListDNSQueryLogsResult {
	items: DNSQuerySummary[]
	total: number
}

export interface DNSRuntimeStatus {
	enabled: boolean
	running: boolean
	listen_addr: string
	upstream: string
	default_ttl: number
}

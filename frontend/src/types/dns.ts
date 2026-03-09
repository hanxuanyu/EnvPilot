import type { Asset, Environment } from '@/types/asset'

export type DNSRecordType = 'A' | 'CNAME'

export interface DNSRecord {
	id: number
	environment_id: number
	asset_id?: number
	domain: string
	record_type: DNSRecordType
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
	value: string
	ttl: number
	enabled: boolean
}

export interface UpdateDNSRecordReq {
	id: number
	asset_id?: number
	domain: string
	record_type: DNSRecordType
	value: string
	ttl: number
	enabled: boolean
}

export interface DNSQueryLog {
	id: number
	environment_id?: number
	domain: string
	question_type: string
	response_code: string
	answer_summary: string
	source: string
	hit_local: boolean
	upstream_used: boolean
	client_ip: string
	duration_ms: number
	queried_at: string
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
	items: DNSQueryLog[]
	total: number
}

export interface DNSRuntimeStatus {
	enabled: boolean
	running: boolean
	listen_addr: string
	upstream: string
	default_ttl: number
}
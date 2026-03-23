import { IS_SERVER_MODE, http, unwrapResult } from '@/lib/apiClient'
import type {
	CreateDNSRecordReq,
	DNSRecord,
	DNSRuntimeStatus,
	ListDNSQueryLogsReq,
	ListDNSQueryLogsResult,
	ListDNSRecordsReq,
	UpdateDNSRecordReq,
} from '@/types/dns'

const EMPTY_DNS_STATUS: DNSRuntimeStatus = {
	enabled: false,
	running: false,
	listen_addr: '',
	upstream: '',
	default_ttl: 0,
}

function normalizeRecordList(value: unknown): DNSRecord[] {
	return Array.isArray(value) ? value as DNSRecord[] : []
}

function normalizeSummaryResult(value: unknown): ListDNSQueryLogsResult {
	if (!value || typeof value !== 'object') {
		return { items: [], total: 0 }
	}
	const result = value as Partial<ListDNSQueryLogsResult>
	return {
		items: Array.isArray(result.items) ? result.items : [],
		total: typeof result.total === 'number' ? result.total : 0,
	}
}

function normalizeStatus(value: unknown): DNSRuntimeStatus {
	if (!value || typeof value !== 'object') {
		return EMPTY_DNS_STATUS
	}
	return { ...EMPTY_DNS_STATUS, ...(value as Partial<DNSRuntimeStatus>) }
}

function getDesktopAPI() {
	const api = (window as any).go?.dnsapi?.DNSAPI
	if (!api) throw new Error('DNSAPI 未绑定')
	return api
}

export const dnsService = {
	list: async (req: ListDNSRecordsReq = {}) => {
		if (IS_SERVER_MODE) {
			return normalizeRecordList(await http.get<DNSRecord[]>('/api/dns/records', req as any))
		}
		const result = await getDesktopAPI().ListRecords(req)
		return normalizeRecordList(unwrapResult(result as any))
	},
	getByAssetId: async (assetId: number) => {
		if (IS_SERVER_MODE) {
			return http.get<DNSRecord | null>(`/api/dns/records/by-asset/${assetId}`)
		}
		const result = await getDesktopAPI().GetRecordByAssetID(assetId)
		return unwrapResult(result as any) as DNSRecord | null
	},
	create: async (req: CreateDNSRecordReq) => {
		if (IS_SERVER_MODE) return http.post<DNSRecord>('/api/dns/records', req)
		const result = await getDesktopAPI().CreateRecord(req)
		return unwrapResult(result as any) as DNSRecord
	},
	update: async (req: UpdateDNSRecordReq) => {
		if (IS_SERVER_MODE) return http.put<DNSRecord>(`/api/dns/records/${req.id}`, req)
		const result = await getDesktopAPI().UpdateRecord(req)
		return unwrapResult(result as any) as DNSRecord
	},
	delete: async (id: number) => {
		if (IS_SERVER_MODE) {
			await http.delete<boolean>(`/api/dns/records/${id}`)
			return
		}
		const result = await getDesktopAPI().DeleteRecord(id)
		unwrapResult(result as any)
	},
	setEnabled: async (id: number, enabled: boolean) => {
		if (IS_SERVER_MODE) return http.post<DNSRecord>(`/api/dns/records/${id}/enabled`, { enabled })
		const result = await getDesktopAPI().SetRecordEnabled(id, enabled)
		return unwrapResult(result as any) as DNSRecord
	},
	listQueryLogs: async (req: ListDNSQueryLogsReq = {}) => {
		if (IS_SERVER_MODE) {
			return normalizeSummaryResult(await http.get<ListDNSQueryLogsResult>('/api/dns/logs', req as any))
		}
		const result = await getDesktopAPI().ListQueryLogs(req)
		return normalizeSummaryResult(unwrapResult(result as any))
	},
	getStatus: async () => {
		if (IS_SERVER_MODE) {
			return normalizeStatus(await http.get<DNSRuntimeStatus>('/api/dns/status'))
		}
		const result = await getDesktopAPI().GetStatus()
		return normalizeStatus(unwrapResult(result as any))
	},
}

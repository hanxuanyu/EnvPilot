import type { Asset } from '@/types/asset'

export function prettyValue(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function parseHeaders(input: string): Record<string, string> {
  const trimmed = input.trim()
  if (!trimmed) return {}
  const parsed = JSON.parse(trimmed) as Record<string, unknown>
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    result[key] = typeof value === 'string' ? value : JSON.stringify(value)
  }
  return result
}

export function safeAddress(asset: Asset): string {
  const cfg = asset.ext_config ?? {}
  const host = cfg['host'] as string | undefined
  const port = cfg['port'] as number | undefined
  if (host && port) return `${host}:${port}`
  if (host) return host
  const brokers = cfg['brokers'] as string | undefined
  if (brokers) return brokers
  const ns = cfg['name_server'] as string | undefined
  if (ns) return ns
  return '—'
}
import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Command, CornerDownLeft, FileSearch, KeyRound, LoaderCircle, SearchCode, Server, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { assetService, credentialService } from '@/services/assetService'
import { dnsService } from '@/services/dnsService'
import type { Asset, Credential } from '@/types/asset'
import { CATEGORY_LABELS, CREDENTIAL_TYPE_LABELS, getAssetAddress } from '@/types/asset'
import type { DNSRecord, DNSRuntimeStatus } from '@/types/dns'
import { commandItems } from './navigation'

interface GlobalCommandPaletteProps {
  open: boolean
  query: string
  onQueryChange: (value: string) => void
  onOpenChange: (open: boolean) => void
}

interface SearchEntry {
  id: string
  type: 'page' | 'action' | 'asset' | 'credential' | 'dns'
  group: string
  label: string
  description: string
  to: string
  keywords: string[]
  badge?: string
}

function buildPath(pathname: string, params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return
    searchParams.set(key, String(value))
  })
  const query = searchParams.toString()
  return query ? `${pathname}?${query}` : pathname
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map(normalizeValue).filter(Boolean).join(' ')
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).map(normalizeValue).filter(Boolean).join(' ')
  return String(value)
}

function highlightText(text: string, query: string) {
  const keyword = query.trim()
  if (!keyword) return text

  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'ig')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, index) => (
        index % 2 === 1 ? (
          <mark
            key={`${part}-${index}`}
            className="rounded px-0.5"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 22%, transparent)', color: 'var(--color-foreground)' }}
          >
            {part}
          </mark>
        ) : (
          <Fragment key={`${part}-${index}`}>{part}</Fragment>
        )
      ))}
    </>
  )
}

export function GlobalCommandPalette({
  open,
  query,
  onQueryChange,
  onOpenChange,
}: GlobalCommandPaletteProps) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([])
  const [dnsStatus, setDnsStatus] = useState<DNSRuntimeStatus | null>(null)
  const [loadingIndex, setLoadingIndex] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return

    let cancelled = false

    const loadIndex = async () => {
      setLoadingIndex(true)
      const [assetResult, credentialResult, dnsResult, dnsStatusResult] = await Promise.allSettled([
        assetService.list(),
        credentialService.list(),
        dnsService.list(),
        dnsService.getStatus(),
      ])

      if (cancelled) return

      setAssets(assetResult.status === 'fulfilled' && Array.isArray(assetResult.value) ? assetResult.value as Asset[] : [])
      setCredentials(credentialResult.status === 'fulfilled' && Array.isArray(credentialResult.value) ? credentialResult.value as Credential[] : [])
      setDnsRecords(dnsResult.status === 'fulfilled' && Array.isArray(dnsResult.value) ? dnsResult.value as DNSRecord[] : [])
      setDnsStatus(dnsStatusResult.status === 'fulfilled' ? dnsStatusResult.value as DNSRuntimeStatus : null)
      setLoadingIndex(false)
    }

    void loadIndex()

    return () => {
      cancelled = true
    }
  }, [open])

  const indexedItems = useMemo<SearchEntry[]>(() => {
    const staticItems: SearchEntry[] = commandItems.map((item) => ({
      ...item,
      badge: item.type === 'page' ? '页面' : '操作',
    }))

    const assetItems: SearchEntry[] = assets.map((asset) => ({
      id: `asset:${asset.id}`,
      type: 'asset',
      group: '资产',
      label: asset.name,
      description: [CATEGORY_LABELS[asset.category], getAssetAddress(asset), asset.environment?.name, asset.group?.name, asset.description].filter(Boolean).join(' · '),
      to: buildPath('/assets', { tab: 'assets', keyword: asset.name, asset: asset.id }),
      keywords: [
        asset.name,
        asset.category,
        CATEGORY_LABELS[asset.category],
        asset.plugin_type,
        asset.description,
        ...(asset.tags ?? []),
        normalizeValue(asset.ext_config),
        asset.environment?.name ?? '',
        asset.group?.name ?? '',
        asset.credential?.name ?? '',
      ],
      badge: '资产',
    }))

    const credentialItems: SearchEntry[] = credentials.map((credential) => ({
      id: `credential:${credential.id}`,
      type: 'credential',
      group: '凭据',
      label: credential.name,
      description: [CREDENTIAL_TYPE_LABELS[credential.type], credential.username || '未填写用户名'].join(' · '),
      to: buildPath('/assets', { tab: 'credentials', keyword: credential.name, credential: credential.id }),
      keywords: [credential.name, credential.type, CREDENTIAL_TYPE_LABELS[credential.type], credential.username, credential.secret_masked ?? ''],
      badge: '凭据',
    }))

    const dnsItems: SearchEntry[] = dnsRecords.map((record) => ({
      id: `dns:${record.id}`,
      type: 'dns',
      group: 'DNS 配置',
      label: record.domain,
      description: [record.record_type, record.value, record.environment?.name, record.asset?.name, record.enabled ? '已启用' : '已停用'].filter(Boolean).join(' · '),
      to: buildPath('/dns', { keyword: record.domain, record: record.id }),
      keywords: [record.domain, record.value, record.record_type, record.environment?.name ?? '', record.asset?.name ?? ''],
      badge: 'DNS',
    }))

    const dnsRuntimeItem: SearchEntry[] = dnsStatus ? [{
      id: 'dns:runtime',
      type: 'dns',
      group: 'DNS 配置',
      label: 'DNS 运行配置',
      description: `${dnsStatus.enabled ? '已启用' : '未启用'} · ${dnsStatus.running ? '运行中' : '未运行'} · ${dnsStatus.listen_addr || '未配置监听地址'}`,
      to: buildPath('/dns', { keyword: dnsStatus.listen_addr || 'dns' }),
      keywords: ['dns', 'status', 'runtime', dnsStatus.listen_addr, dnsStatus.upstream, String(dnsStatus.default_ttl)],
      badge: '配置',
    }] : []

    return [...staticItems, ...assetItems, ...credentialItems, ...dnsItems, ...dnsRuntimeItem]
  }, [assets, credentials, dnsRecords, dnsStatus])

  const filteredItems = useMemo(() => {
    const keyword = deferredQuery.trim().toLowerCase()
    if (!keyword) {
      return indexedItems.filter((item) => item.type === 'page' || item.type === 'action')
    }
    return indexedItems.filter((item) => {
      const haystack = [item.label, item.description, item.group, ...item.keywords].join(' ').toLowerCase()
      return haystack.includes(keyword)
    })
  }, [deferredQuery, indexedItems])

  const groupedItems = useMemo(() => {
    const pages = filteredItems.filter((item) => item.type === 'page')
    const actions = filteredItems.filter((item) => item.type === 'action')
    const assetItems = filteredItems.filter((item) => item.type === 'asset').slice(0, 8)
    const credentialItems = filteredItems.filter((item) => item.type === 'credential').slice(0, 6)
    const dnsItems = filteredItems.filter((item) => item.type === 'dns').slice(0, 8)
    return [
      { key: 'pages', title: '页面', items: pages },
      { key: 'actions', title: '快捷操作', items: actions },
      { key: 'assets', title: '资产', items: assetItems },
      { key: 'credentials', title: '凭据', items: credentialItems },
      { key: 'dns', title: 'DNS 配置', items: dnsItems },
    ].filter((group) => group.items.length > 0)
  }, [filteredItems])

  useEffect(() => {
    setSelectedIndex(0)
  }, [open, deferredQuery, filteredItems.length])

  useEffect(() => {
    const activeItem = filteredItems[selectedIndex]
    if (!activeItem) return
    itemRefs.current[activeItem.id]?.scrollIntoView({ block: 'nearest' })
  }, [filteredItems, selectedIndex])

  const handleSelect = (item: SearchEntry) => {
    navigate(item.to)
    onOpenChange(false)
  }

  const activeItem = filteredItems[selectedIndex] ?? filteredItems[0]

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="全局搜索与命令面板"
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'color-mix(in srgb, var(--color-secondary) 35%, transparent)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 16%, transparent)', color: 'var(--color-primary)' }}>
              <FileSearch className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    if (filteredItems.length === 0) return
                    setSelectedIndex((current) => Math.min(filteredItems.length - 1, current + 1))
                    return
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    if (filteredItems.length === 0) return
                    setSelectedIndex((current) => Math.max(0, current - 1))
                    return
                  }
                  if (event.key === 'Enter' && activeItem) {
                    event.preventDefault()
                    handleSelect(activeItem)
                  }
                }}
                placeholder="搜索页面、资产、凭据、DNS 配置，例如 redis / root / example.com"
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
              <div className="mt-1 flex items-center gap-3 text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
                <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" />覆盖全局导航与运行数据索引</span>
                <span className="inline-flex items-center gap-1"><CornerDownLeft className="h-3 w-3" />回车打开首项</span>
                <span className="inline-flex items-center gap-1"><Command className="h-3 w-3" />上下键切换</span>
              </div>
            </div>
            <div className="hidden rounded-full border px-2 py-1 text-[11px] md:flex items-center gap-1" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
              <Command className="h-3 w-3" />
              <span>Cmd/Ctrl + K</span>
            </div>
          </div>
        </div>

        <div className="max-h-[56vh] space-y-4 overflow-y-auto pr-1">
          {loadingIndex ? (
            <div className="rounded-2xl border px-4 py-4 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
              <span className="inline-flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                <span>正在建立全局搜索索引…</span>
              </span>
            </div>
          ) : null}

          {!deferredQuery.trim() ? (
            <div className="grid gap-2 md:grid-cols-3">
              {[
                { label: '页面导航', detail: `${commandItems.filter((item) => item.type === 'page').length} 个模块入口`, icon: SearchCode },
                { label: '资产与凭据', detail: `${assets.length} 项资产 / ${credentials.length} 条凭据`, icon: Server },
                { label: 'DNS 配置', detail: `${dnsRecords.length} 条记录${dnsStatus ? ` / ${dnsStatus.running ? '运行中' : '未运行'}` : ''}`, icon: KeyRound },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                    <item.icon className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                    <span>{item.label}</span>
                  </div>
                  <div className="mt-2 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{item.detail}</div>
                </div>
              ))}
            </div>
          ) : null}

          {groupedItems.length > 0 ? groupedItems.map((group) => (
            <div key={group.key} className="space-y-2">
              <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--color-muted-foreground)' }}>
                {group.title}
              </div>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const isActive = activeItem?.id === item.id
                  return (
                  <button
                    key={item.id}
                    type="button"
                    ref={(element) => {
                      itemRefs.current[item.id] = element
                    }}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => {
                      const nextIndex = filteredItems.findIndex((entry) => entry.id === item.id)
                      if (nextIndex >= 0) setSelectedIndex(nextIndex)
                    }}
                    className={cn(
                      'w-full rounded-2xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5',
                      isActive ? 'shadow-sm' : ''
                    )}
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: isActive
                        ? 'color-mix(in srgb, var(--color-primary) 8%, var(--color-card))'
                        : 'var(--color-card)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>{highlightText(item.label, deferredQuery)}</div>
                        <div className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted-foreground)' }}>{highlightText(item.description, deferredQuery)}</div>
                      </div>
                      <span className="shrink-0 rounded-full px-2 py-1 text-[10px]" style={{ backgroundColor: 'color-mix(in srgb, var(--color-secondary) 52%, transparent)', color: 'var(--color-muted-foreground)' }}>
                        {item.badge ?? item.group}
                      </span>
                    </div>
                  </button>
                )})}
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border px-4 py-10 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}>
              没有匹配项，试试输入页面名、资产名、凭据名或 DNS 域名。
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
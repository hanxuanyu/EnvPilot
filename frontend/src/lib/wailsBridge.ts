import { IS_SERVER_MODE } from '@/lib/apiClient'

export type WailsBridgeStatus = 'unknown' | 'healthy' | 'unhealthy'

export interface WailsBridgeStatusDetail {
  status: WailsBridgeStatus
  reason: string
  changedAt: number
}

declare global {
  interface WindowEventMap {
    'envpilot:wails-bridge-status': CustomEvent<WailsBridgeStatusDetail>
  }
}

const BRIDGE_STATUS_EVENT = 'envpilot:wails-bridge-status'
const GO_CALL_TIMEOUT_MS = 12000
const PING_PROBE_TIMEOUT_MS = 4000
const PATCH_SCAN_INTERVAL_MS = 1000
const PROBE_DEBOUNCE_MS = 1200
const HEALTHCHECK_INTERVAL_MS = 30000

const GO_BINDING_NAMESPACES = [
  'main',
  'authapi',
  'assetapi',
  'auditapi',
  'configapi',
  'connectorapi',
  'dnsapi',
  'healthapi',
  'executorapi',
] as const

const WRAPPED_METHOD = Symbol('envpilot.wailsBridge.wrappedMethod')
const ORIGINAL_METHOD = Symbol('envpilot.wailsBridge.originalMethod')

let installed = false
let status: WailsBridgeStatus = 'unknown'
let lastReason = 'bootstrap'
let lastChangedAt = Date.now()
let probeTimer: number | null = null
let probeInFlight: Promise<boolean> | null = null

function dispatchBridgeStatus(nextStatus: WailsBridgeStatus, reason: string) {
  if (typeof window === 'undefined') return

  const changed = status !== nextStatus || lastReason !== reason
  status = nextStatus
  lastReason = reason
  if (changed) {
    lastChangedAt = Date.now()
  }

  window.dispatchEvent(new CustomEvent<WailsBridgeStatusDetail>(BRIDGE_STATUS_EVENT, {
    detail: {
      status,
      reason,
      changedAt: lastChangedAt,
    },
  }))
}

function markBridgeHealthy(reason: string) {
  dispatchBridgeStatus('healthy', reason)
}

function markBridgeUnhealthy(reason: string) {
  dispatchBridgeStatus('unhealthy', reason)
  scheduleBridgeProbe(reason)
}

function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return typeof value === 'object' && value !== null && typeof (value as Promise<T>).then === 'function'
}

function hasGoBindings(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).go !== 'undefined'
}

function isBridgeRelatedError(error: unknown): boolean {
  const message = String((error as { message?: string } | undefined)?.message ?? error ?? '').toLowerCase()
  if (!message) return false

  return [
    'bridge',
    'context canceled',
    'ipc',
    'not ready',
    'disconnected',
    'renderer',
    'runtime',
    'webview',
    'invoke',
  ].some((token) => message.includes(token))
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  methodPath: string,
  markHealthyOnResolve = true,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      markBridgeUnhealthy(`timeout:${methodPath}`)
      reject(new Error(`桌面桥接调用超时: ${methodPath}`))
    }, timeoutMs)

    promise.then((value) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      if (markHealthyOnResolve) {
        markBridgeHealthy(`ok:${methodPath}`)
      }
      resolve(value)
    }).catch((error) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      if (isBridgeRelatedError(error)) {
        markBridgeUnhealthy(`error:${methodPath}`)
      }
      reject(error)
    })
  })
}

function wrapGoMethod<T extends (...args: any[]) => any>(method: T, methodPath: string): T {
  if ((method as any)[WRAPPED_METHOD]) {
    return method
  }

  const wrapped = function wrappedGoMethod(this: unknown, ...args: Parameters<T>) {
    if (!hasGoBindings()) {
      markBridgeUnhealthy(`missing:${methodPath}`)
      return Promise.reject(new Error('桌面桥接尚未就绪，请稍后重试'))
    }

    try {
      const result = method.apply(this, args)
      const promise = isPromiseLike<ReturnType<T>>(result)
        ? result
        : Promise.resolve(result as ReturnType<T>)
      return withTimeout(promise, GO_CALL_TIMEOUT_MS, methodPath)
    } catch (error) {
      if (isBridgeRelatedError(error)) {
        markBridgeUnhealthy(`throw:${methodPath}`)
      }
      throw error
    }
  }

  ;(wrapped as any)[WRAPPED_METHOD] = true
  ;(wrapped as any)[ORIGINAL_METHOD] = method
  return wrapped as T
}

function patchNamespace(node: Record<string, unknown>, path: string[]) {
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'function') {
      node[key] = wrapGoMethod(value as (...args: any[]) => any, [...path, key].join('.'))
      continue
    }

    if (value && typeof value === 'object') {
      patchNamespace(value as Record<string, unknown>, [...path, key])
    }
  }
}

function patchWailsBindings(): boolean {
  if (IS_SERVER_MODE || !hasGoBindings()) return false

  const goBindings = (window as any).go as Record<string, Record<string, unknown>>
  let patched = false

  for (const namespace of GO_BINDING_NAMESPACES) {
    const target = goBindings?.[namespace]
    if (!target || typeof target !== 'object') continue
    patchNamespace(target, ['window', 'go', namespace])
    patched = true
  }

  return patched
}

function scheduleBridgeProbe(reason: string) {
  if (IS_SERVER_MODE || typeof window === 'undefined') return
  if (document.visibilityState === 'hidden') return
  if (probeTimer !== null) return

  probeTimer = window.setTimeout(() => {
    probeTimer = null
    void probeWailsBridge(`scheduled:${reason}`)
  }, PROBE_DEBOUNCE_MS)
}

function getRawPing(): (() => Promise<string>) | null {
  const appObject = (window as any)?.go?.main?.App
  if (!appObject || typeof appObject !== 'object') return null

  const ping = appObject.Ping
  if (typeof ping !== 'function') return null

  const original = (ping as any)[ORIGINAL_METHOD]
  const callable = typeof original === 'function' ? original : ping
  return () => Promise.resolve(callable.call(appObject))
}

export function getWailsBridgeStatus(): WailsBridgeStatusDetail {
  return {
    status,
    reason: lastReason,
    changedAt: lastChangedAt,
  }
}

export function subscribeWailsBridgeStatus(
  listener: (detail: WailsBridgeStatusDetail) => void,
): () => void {
  const handler = (event: Event) => {
    listener((event as CustomEvent<WailsBridgeStatusDetail>).detail)
  }

  window.addEventListener(BRIDGE_STATUS_EVENT, handler)
  return () => window.removeEventListener(BRIDGE_STATUS_EVENT, handler)
}

export function probeWailsBridge(reason = 'manual'): Promise<boolean> {
  if (IS_SERVER_MODE) return Promise.resolve(true)
  if (probeInFlight) return probeInFlight

  probeInFlight = (async () => {
    if (!patchWailsBindings()) {
      markBridgeUnhealthy(`bindings-missing:${reason}`)
      return false
    }

    const ping = getRawPing()
    if (!ping) {
      markBridgeUnhealthy(`ping-missing:${reason}`)
      return false
    }

    try {
      await withTimeout(ping(), PING_PROBE_TIMEOUT_MS, 'window.go.main.App.Ping', false)
      markBridgeHealthy(`probe:${reason}`)
      return true
    } catch {
      markBridgeUnhealthy(`probe:${reason}`)
      return false
    } finally {
      probeInFlight = null
    }
  })()

  return probeInFlight
}

export function installWailsBridgeMonitor() {
  if (installed || IS_SERVER_MODE || typeof window === 'undefined') return
  installed = true

  const patchAndProbe = (reason: string) => {
    patchWailsBindings()
    void probeWailsBridge(reason)
  }

  patchAndProbe('bootstrap')
  window.setInterval(() => {
    patchWailsBindings()
  }, PATCH_SCAN_INTERVAL_MS)

  window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      patchAndProbe('interval-healthcheck')
    }
  }, HEALTHCHECK_INTERVAL_MS)

  window.addEventListener('focus', () => {
    patchAndProbe('window-focus')
  })

  window.addEventListener('pageshow', () => {
    patchAndProbe('pageshow')
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      patchAndProbe('visibility-visible')
    }
  })
}

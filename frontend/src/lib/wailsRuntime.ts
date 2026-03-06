/**
 * wailsRuntime.ts – Wails v2 运行时的浏览器安全封装层
 *
 * 问题背景：
 *   Wails runtime.js 中所有函数直接调用 window.runtime.XXX。
 *   在以下场景中 window.runtime 为 undefined，导致 TypeError 崩溃：
 *     1. 普通浏览器直接访问（无 Wails WebView）
 *     2. wails dev 模式下页面刷新，WebSocket 桥接重连完成之前
 *
 * 解决方案：
 *   本模块提供与原 @wailsjs/runtime/runtime 完全相同的 API，
 *   但在调用前先检查 window.runtime 是否就绪，未就绪时静默降级（no-op）。
 *
 * 使用方式：
 *   - 替换所有 import ... from '@wailsjs/runtime/runtime' 为本模块
 *   - 其余代码无需修改
 */

import {
  EventsOn as _EventsOn,
  EventsOff as _EventsOff,
  EventsOnce as _EventsOnce,
} from '@wailsjs/runtime/runtime'

// ── 环境检测 ──────────────────────────────────────────────────────

/** 当前是否在 Wails WebView 桥接就绪状态下运行 */
export const isWailsBridge = (): boolean =>
  typeof (window as any).runtime !== 'undefined'

/** 当前是否有 Wails Go 绑定（window.go）可用 */
export const isWailsGo = (): boolean =>
  typeof (window as any).go !== 'undefined'

/** 当前是否处于某种 Wails 运行环境（桥接或 Go 绑定任意一个存在） */
export const isWailsEnv = (): boolean => isWailsBridge() || isWailsGo()

// ── 浏览器安全的事件 API ──────────────────────────────────────────

/**
 * 订阅 Wails 事件（多次触发）。
 * 在浏览器模式下（window.runtime 不存在）静默忽略，不崩溃。
 */
export const EventsOn = (
  eventName: string,
  callback: (...data: any[]) => void,
): void => {
  if (isWailsBridge()) _EventsOn(eventName, callback)
}

/**
 * 取消订阅 Wails 事件。
 * 在浏览器模式下静默忽略。
 */
export const EventsOff = (eventName: string, ...additionalEventNames: string[]): void => {
  if (isWailsBridge()) _EventsOff(eventName, ...additionalEventNames)
}

/**
 * 订阅 Wails 事件（只触发一次）。
 * 在浏览器模式下静默忽略。
 */
export const EventsOnce = (
  eventName: string,
  callback: (...data: any[]) => void,
): void => {
  if (isWailsBridge()) _EventsOnce(eventName, callback)
}

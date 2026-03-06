// utils.ts 前端公共工具函数
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * cn - 合并 Tailwind CSS 类名，自动处理冲突
 * 用于组件内条件式样式拼接
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * formatDate - 格式化时间戳为本地时间字符串
 */
export function formatDate(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * maskSecret - 脱敏显示敏感字符串
 * 例如：password123 → pass*****
 */
export function maskSecret(value: string, visibleChars = 4): string {
  if (!value || value.length <= visibleChars) {
    return '****'
  }
  return value.substring(0, visibleChars) + '*'.repeat(Math.min(value.length - visibleChars, 8))
}

/**
 * sleep - 异步等待（毫秒）
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

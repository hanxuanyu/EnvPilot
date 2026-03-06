// executorService.ts  命令执行 + 在线终端模块的后端调用封装
import * as ExecutorAPIJs from '@wailsjs/go/executorapi/ExecutorAPI'
import { EventsOn, EventsOff } from '@wailsjs/runtime/runtime'
import type { model } from '@wailsjs/go/models'

// ── 内部工具 ──────────────────────────────────────────────────
function unwrap<T>(result: { ok: boolean; data: T; message: string }): T {
  if (!result.ok) throw new Error(result.message || '操作失败')
  return result.data
}

// ── 类型别名 ──────────────────────────────────────────────────
// Execution 在 model 命名空间中（executor/model 包名也是 model）
export type Execution = model.Execution
export type ExecutionStatus = 'running' | 'success' | 'failed' | 'interrupted'

export interface ExecuteResult {
  dangerous: boolean
  execution?: Execution
}

export interface BatchExecuteResult {
  results: ExecuteResult[]
  dangerous: boolean
}

export interface ExecutionListResult {
  list: Execution[]
  total: number
}

// ── 命令执行 ──────────────────────────────────────────────────
export const executorService = {
  // 单条命令执行（异步，实时输出通过事件推送）
  execute: async (req: {
    asset_id: number
    command: string
    operator?: string
    force?: boolean
  }): Promise<ExecuteResult> => {
    const r = await ExecutorAPIJs.ExecuteCommand({
      asset_id: req.asset_id,
      command: req.command,
      operator: req.operator ?? 'admin',
      force: req.force ?? false,
    } as any)
    return unwrap(r as any) as ExecuteResult
  },

  // 批量执行
  batchExecute: async (req: {
    asset_ids: number[]
    command: string
    operator?: string
    force?: boolean
  }): Promise<BatchExecuteResult> => {
    const r = await ExecutorAPIJs.BatchExecuteCommand({
      asset_ids: req.asset_ids,
      command: req.command,
      operator: req.operator ?? 'admin',
      force: req.force ?? false,
    } as any)
    return unwrap(r as any) as BatchExecuteResult
  },

  // 获取单条执行记录
  getExecution: async (id: number): Promise<Execution> => {
    const r = await ExecutorAPIJs.GetExecution(id)
    return unwrap(r as any) as Execution
  },

  // 分页查询执行历史
  listExecutions: async (req: {
    asset_id?: number
    page?: number
    page_size?: number
  } = {}): Promise<ExecutionListResult> => {
    const r = await ExecutorAPIJs.ListExecutions({
      asset_id: req.asset_id ?? 0,
      page: req.page ?? 1,
      page_size: req.page_size ?? 20,
    } as any)
    return unwrap(r as any) as ExecutionListResult
  },

  // 检查是否为高危命令
  checkDangerous: async (command: string): Promise<boolean> => {
    const r = await ExecutorAPIJs.CheckDangerousCommand(command)
    return unwrap(r as any) as boolean
  },

  // ── 事件订阅（实时输出）────────────────────────────────────
  onOutput: (execId: number, cb: (chunk: string) => void) =>
    EventsOn(`executor:output:${execId}`, cb),

  offOutput: (execId: number) =>
    EventsOff(`executor:output:${execId}`),

  onDone: (execId: number, cb: (data: { exec_id: number; exit_code: number; status: string; output: string }) => void) =>
    EventsOn(`executor:done:${execId}`, cb),

  offDone: (execId: number) =>
    EventsOff(`executor:done:${execId}`),

  // ── 在线终端 ──────────────────────────────────────────────
  startTerminal: async (assetId: number): Promise<string> => {
    const r = await ExecutorAPIJs.StartTerminal(assetId)
    return unwrap(r as any) as string
  },

  sendInput: async (sessionId: string, data: string): Promise<void> => {
    const r = await ExecutorAPIJs.TerminalInput(sessionId, data)
    unwrap(r as any)
  },

  resizeTerminal: async (sessionId: string, cols: number, rows: number): Promise<void> => {
    const r = await ExecutorAPIJs.ResizeTerminal(sessionId, cols, rows)
    unwrap(r as any)
  },

  closeTerminal: async (sessionId: string): Promise<void> => {
    const r = await ExecutorAPIJs.CloseTerminal(sessionId)
    unwrap(r as any)
  },

  // 终端输出：base64 编码的二进制数据
  onTerminalOutput: (sessionId: string, cb: (data: string) => void) =>
    EventsOn(`terminal:output:${sessionId}`, cb),

  offTerminalOutput: (sessionId: string) =>
    EventsOff(`terminal:output:${sessionId}`),

  onTerminalClosed: (sessionId: string, cb: () => void) =>
    EventsOn(`terminal:closed:${sessionId}`, cb),

  offTerminalClosed: (sessionId: string) =>
    EventsOff(`terminal:closed:${sessionId}`),
}

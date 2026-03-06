// executorService.ts — 命令执行 + 在线终端（桌面 / 服务端双模式）
import { IS_SERVER_MODE, http, subscribeSSE, terminalWSManager } from '@/lib/apiClient'
import { EventsOn, EventsOff } from '@/lib/wailsRuntime'
import type { model } from '@wailsjs/go/models'

// ── 桌面模式：Wails 绑定 ──────────────────────────────────────────
import * as ExecutorAPIJs from '@wailsjs/go/executorapi/ExecutorAPI'

function wailsUnwrap<T>(result: { success: boolean; data: T; message: string }): T {
  if (!result.success) throw new Error(result.message || '操作失败')
  return result.data
}

// ── 类型 ──────────────────────────────────────────────────────────

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

// ── 命令执行 ──────────────────────────────────────────────────────

export const executorService = {
  execute: async (req: {
    asset_id: number
    command: string
    operator?: string
    force?: boolean
  }): Promise<ExecuteResult> => {
    if (IS_SERVER_MODE) {
      return http.post<ExecuteResult>('/api/executions', {
        asset_id: req.asset_id,
        command: req.command,
        operator: req.operator ?? 'admin',
        force: req.force ?? false,
      })
    }
    const r = await ExecutorAPIJs.ExecuteCommand({
      asset_id: req.asset_id,
      command: req.command,
      operator: req.operator ?? 'admin',
      force: req.force ?? false,
    } as any)
    return wailsUnwrap(r as any) as ExecuteResult
  },

  batchExecute: async (req: {
    asset_ids: number[]
    command: string
    operator?: string
    force?: boolean
  }): Promise<BatchExecuteResult> => {
    if (IS_SERVER_MODE) {
      return http.post<BatchExecuteResult>('/api/executions/batch', {
        asset_ids: req.asset_ids,
        command: req.command,
        operator: req.operator ?? 'admin',
        force: req.force ?? false,
      })
    }
    const r = await ExecutorAPIJs.BatchExecuteCommand({
      asset_ids: req.asset_ids,
      command: req.command,
      operator: req.operator ?? 'admin',
      force: req.force ?? false,
    } as any)
    return wailsUnwrap(r as any) as BatchExecuteResult
  },

  getExecution: async (id: number): Promise<Execution> => {
    if (IS_SERVER_MODE) return http.get<Execution>(`/api/executions/${id}`)
    const r = await ExecutorAPIJs.GetExecution(id)
    return wailsUnwrap(r as any) as Execution
  },

  listExecutions: async (req: {
    asset_id?: number
    page?: number
    page_size?: number
  } = {}): Promise<ExecutionListResult> => {
    if (IS_SERVER_MODE) {
      return http.get<ExecutionListResult>('/api/executions', {
        asset_id: req.asset_id,
        page: req.page ?? 1,
        page_size: req.page_size ?? 20,
      } as any)
    }
    const r = await ExecutorAPIJs.ListExecutions({
      asset_id: req.asset_id ?? 0,
      page: req.page ?? 1,
      page_size: req.page_size ?? 20,
    } as any)
    return wailsUnwrap(r as any) as ExecutionListResult
  },

  checkDangerous: async (command: string): Promise<boolean> => {
    if (IS_SERVER_MODE) {
      return http.post<boolean>('/api/commands/check-dangerous', { command })
    }
    const r = await ExecutorAPIJs.CheckDangerousCommand(command)
    return wailsUnwrap(r as any) as boolean
  },

  // ── 实时事件订阅 ──────────────────────────────────────────────

  /**
   * 订阅命令输出流。
   * - 桌面模式：Wails EventsOn
   * - 服务端模式：SSE /api/executions/{id}/stream，type=output
   * @returns 取消订阅函数
   */
  onOutput: (execId: number, cb: (chunk: string) => void): (() => void) => {
    if (IS_SERVER_MODE) {
      // SSE 订阅由 subscribeExecution 统一管理，此处返回 noop
      EventsOn(`executor:output:${execId}`, cb)   // no-op in server mode
      return () => EventsOff(`executor:output:${execId}`)
    }
    EventsOn(`executor:output:${execId}`, cb)
    return () => EventsOff(`executor:output:${execId}`)
  },

  offOutput: (execId: number) => EventsOff(`executor:output:${execId}`),

  onDone: (
    execId: number,
    cb: (data: { exec_id: number; exit_code: number; status: string; output: string }) => void,
  ): (() => void) => {
    if (IS_SERVER_MODE) {
      EventsOn(`executor:done:${execId}`, cb)   // no-op in server mode
      return () => EventsOff(`executor:done:${execId}`)
    }
    EventsOn(`executor:done:${execId}`, cb)
    return () => EventsOff(`executor:done:${execId}`)
  },

  offDone: (execId: number) => EventsOff(`executor:done:${execId}`),

  /**
   * 服务端模式专用：订阅 SSE 执行流，统一分发 output 和 done 事件。
   * 桌面模式请使用 onOutput / onDone。
   * @returns 取消订阅函数
   */
  subscribeExecution: (
    execId: number,
    onOutput: (chunk: string) => void,
    onDone: (data: { exec_id: number; exit_code: number; status: string; output: string }) => void,
  ): (() => void) => {
    if (!IS_SERVER_MODE) {
      // 桌面模式：复用 Wails 事件
      EventsOn(`executor:output:${execId}`, onOutput)
      EventsOn(`executor:done:${execId}`, onDone)
      return () => {
        EventsOff(`executor:output:${execId}`)
        EventsOff(`executor:done:${execId}`)
      }
    }
    // 服务端模式：SSE
    return subscribeSSE(`/api/executions/${execId}/stream`, (msg) => {
      if (msg.type === 'output') onOutput(msg.data as string)
      else if (msg.type === 'done') onDone(msg.data as any)
    })
  },

  // ── 在线终端 ──────────────────────────────────────────────────

  startTerminal: async (assetId: number): Promise<string> => {
    if (IS_SERVER_MODE) {
      // 服务端模式：通过 WebSocket 建立连接（需配合 terminalWSManager）
      // 此处仅返回临时 ID，实际 sessionId 由 WebSocket 服务端分配
      // 调用方应使用 connectTerminal 代替
      throw new Error('服务端模式请使用 connectTerminal')
    }
    const r = await ExecutorAPIJs.StartTerminal(assetId)
    return wailsUnwrap(r as any) as string
  },

  /**
   * 服务端模式专用：建立 WebSocket 终端连接。
   * 返回 sessionId，后续通过 sendInput / resizeTerminal / closeTerminal 操作。
   */
  connectTerminal: (
    assetId: number,
    onOutput: (data: string) => void,
    onClosed: () => void,
    onError?: (msg: string) => void,
  ): Promise<string> => {
    return terminalWSManager.connect(assetId, { onOutput, onClosed, onError })
  },

  sendInput: async (sessionId: string, data: string): Promise<void> => {
    if (IS_SERVER_MODE) {
      terminalWSManager.send(sessionId, { type: 'input', data })
      return
    }
    const r = await ExecutorAPIJs.TerminalInput(sessionId, data)
    wailsUnwrap(r as any)
  },

  resizeTerminal: async (sessionId: string, cols: number, rows: number): Promise<void> => {
    if (IS_SERVER_MODE) {
      terminalWSManager.send(sessionId, { type: 'resize', cols, rows })
      return
    }
    const r = await ExecutorAPIJs.ResizeTerminal(sessionId, cols, rows)
    wailsUnwrap(r as any)
  },

  closeTerminal: async (sessionId: string): Promise<void> => {
    if (IS_SERVER_MODE) {
      terminalWSManager.close(sessionId)
      return
    }
    const r = await ExecutorAPIJs.CloseTerminal(sessionId)
    wailsUnwrap(r as any)
  },

  onTerminalOutput: (sessionId: string, cb: (data: string) => void) =>
    EventsOn(`terminal:output:${sessionId}`, cb),

  offTerminalOutput: (sessionId: string) =>
    EventsOff(`terminal:output:${sessionId}`),

  onTerminalClosed: (sessionId: string, cb: () => void) =>
    EventsOn(`terminal:closed:${sessionId}`, cb),

  offTerminalClosed: (sessionId: string) =>
    EventsOff(`terminal:closed:${sessionId}`),
}

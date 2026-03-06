// executorStore.ts  命令执行模块全局状态（Zustand）
import { create } from 'zustand'
import type { Execution, ExecutionListResult } from '@/services/executorService'
import { executorService } from '@/services/executorService'

interface OutputBuffer {
  [execId: number]: string
}

interface ExecutorState {
  // ── 数据 ──
  executions: Execution[]
  totalExecutions: number
  currentExecution: Execution | null
  outputBuffer: OutputBuffer // execId → 累积输出

  // ── 加载状态 ──
  loading: boolean
  executing: boolean
  error: string | null

  // ── 操作 ──
  loadExecutions: (req?: { asset_id?: number; page?: number; page_size?: number }) => Promise<ExecutionListResult>
  setCurrentExecution: (e: Execution | null) => void
  appendOutput: (execId: number, chunk: string) => void
  clearOutput: (execId: number) => void
  setExecuting: (v: boolean) => void
  setError: (msg: string | null) => void
}

export const useExecutorStore = create<ExecutorState>((set, get) => ({
  executions: [],
  totalExecutions: 0,
  currentExecution: null,
  outputBuffer: {},
  loading: false,
  executing: false,
  error: null,

  loadExecutions: async (req = {}) => {
    set({ loading: true, error: null })
    try {
      const result = await executorService.listExecutions(req)
      set({ executions: result.list, totalExecutions: result.total })
      return result
    } catch (e: any) {
      set({ error: e.message })
      return { list: [], total: 0 }
    } finally {
      set({ loading: false })
    }
  },

  setCurrentExecution: (e) => set({ currentExecution: e }),

  appendOutput: (execId, chunk) => {
    const buf = get().outputBuffer
    set({
      outputBuffer: {
        ...buf,
        [execId]: (buf[execId] ?? '') + chunk,
      },
    })
  },

  clearOutput: (execId) => {
    const buf = { ...get().outputBuffer }
    delete buf[execId]
    set({ outputBuffer: buf })
  },

  setExecuting: (v) => set({ executing: v }),
  setError: (msg) => set({ error: msg }),
}))

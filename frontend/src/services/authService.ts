import { IS_SERVER_MODE, http, unwrapResult } from '@/lib/apiClient'
import type { AuthStatus } from '@/types/auth'

function getDesktopAPI() {
  const api = (window as any).go?.authapi?.AuthAPI
  if (!api) throw new Error('AuthAPI 未绑定')
  return api
}

export const authService = {
  getStatus: async (): Promise<AuthStatus> => {
    if (IS_SERVER_MODE) return http.get<AuthStatus>('/api/auth/status')
    const result = await getDesktopAPI().GetStatus()
    return unwrapResult(result as any) as AuthStatus
  },
  unlock: async (password: string): Promise<AuthStatus> => {
    if (IS_SERVER_MODE) return http.post<AuthStatus>('/api/auth/unlock', { password })
    const result = await getDesktopAPI().Unlock({ password })
    return unwrapResult(result as any) as AuthStatus
  },
  setup: async (password: string): Promise<AuthStatus> => {
    if (IS_SERVER_MODE) return http.post<AuthStatus>('/api/auth/setup', { password })
    const result = await getDesktopAPI().Setup({ password })
    return unwrapResult(result as any) as AuthStatus
  },
  changePassword: async (currentPassword: string, newPassword: string): Promise<AuthStatus> => {
    if (IS_SERVER_MODE) {
      return http.post<AuthStatus>('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
    }
    const result = await getDesktopAPI().ChangePassword({
      current_password: currentPassword,
      new_password: newPassword,
    })
    return unwrapResult(result as any) as AuthStatus
  },
  lock: async (): Promise<void> => {
    if (IS_SERVER_MODE) {
      await http.post<boolean>('/api/auth/lock')
      return
    }
    const result = await getDesktopAPI().Lock()
    unwrapResult(result as any)
  },
}
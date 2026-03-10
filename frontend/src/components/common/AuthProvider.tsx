import { createContext, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { AUTH_REQUIRED_EVENT } from '@/lib/authEvents'
import { authService } from '@/services/authService'
import type { AuthStatus } from '@/types/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/dialog'

interface AuthContextValue {
  status: AuthStatus | null
  loading: boolean
  isReadOnly: boolean
  isProtected: boolean
  openUnlock: () => void
  promptUnlock: (message?: string) => void
  refreshStatus: () => Promise<void>
  lock: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [setupMode, setSetupMode] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [changeMode, setChangeMode] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const hasShownSetupToastRef = useRef(false)

  const refreshStatus = async () => {
    try {
      const next = await authService.getStatus()
      setStatus(next)
      setSetupMode(next.enabled && !next.initialized)
    } catch (error: any) {
      toast.error('加载主密码状态失败', { description: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshStatus()
  }, [])

  useEffect(() => {
    const showUnlockToast = (message?: string) => {
      toast.dismiss('auth-required')
      toast.warning(message || '当前为只读模式，解锁后才能继续该操作。', {
        id: 'auth-required',
        duration: 5000,
        action: {
          label: '立即解锁',
          onClick: () => setDialogOpen(true),
        },
      })
    }

    const onRequired = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>
      showUnlockToast(customEvent.detail?.message)
    }

    window.addEventListener(AUTH_REQUIRED_EVENT, onRequired as EventListener)
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onRequired as EventListener)
  }, [])

  useEffect(() => {
    if (!status?.needs_setup || hasShownSetupToastRef.current) return
    hasShownSetupToastRef.current = true
    toast.info('主密码保护已启用，请先设置主密码。', {
      id: 'auth-setup-required',
      duration: 6000,
      action: {
        label: '现在设置',
        onClick: () => setDialogOpen(true),
      },
    })
  }, [status])

  const resetDialog = () => {
    setPassword('')
    setConfirmPassword('')
    setCurrentPassword('')
    setChangeMode(false)
  }

  const handleUnlock = async () => {
    setSubmitting(true)
    try {
      const next = setupMode
        ? await authService.setup(password)
        : await authService.unlock(password)
      setStatus(next)
      setDialogOpen(false)
      resetDialog()
      toast.success(setupMode ? '主密码已设置并解锁' : '主密码验证成功')
    } catch (error: any) {
      toast.error(setupMode ? '设置主密码失败' : '解锁失败', { description: error.message })
    } finally {
      setSubmitting(false)
    }
  }

  const handleChangePassword = async () => {
    setSubmitting(true)
    try {
      const next = await authService.changePassword(currentPassword, password)
      setStatus(next)
      setDialogOpen(false)
      resetDialog()
      toast.success('主密码已更新')
    } catch (error: any) {
      toast.error('修改主密码失败', { description: error.message })
    } finally {
      setSubmitting(false)
    }
  }

  const lock = async () => {
    await authService.lock()
    await refreshStatus()
    toast.success('已切换为只读模式')
  }

  const value = useMemo<AuthContextValue>(() => ({
    status,
    loading,
    isReadOnly: !!status?.read_only,
    isProtected: !!status?.enabled,
    openUnlock: () => setDialogOpen(true),
    promptUnlock: (message?: string) => {
      toast.dismiss('auth-required')
      toast.warning(message || '当前为只读模式，解锁后才能继续该操作。', {
        id: 'auth-required',
        duration: 5000,
        action: {
          label: '立即解锁',
          onClick: () => setDialogOpen(true),
        },
      })
    },
    refreshStatus,
    lock,
  }), [status, loading])

  const submitDisabled = submitting
    || !password.trim()
    || ((setupMode || changeMode) && password !== confirmPassword)
    || (changeMode && !currentPassword.trim())

  const handleSubmitKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || submitDisabled) return
    event.preventDefault()
    void (changeMode ? handleChangePassword() : handleUnlock())
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      <Modal
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          resetDialog()
        }}
        title={changeMode ? '修改主密码' : setupMode ? '设置主密码' : '输入主密码'}
        footer={(
          <>
            <Button variant="outline" onClick={() => {
              setDialogOpen(false)
              resetDialog()
            }}>
              取消
            </Button>
            <Button
              onClick={changeMode ? handleChangePassword : handleUnlock}
              loading={submitting}
              disabled={submitDisabled}
            >
              {changeMode ? '更新密码' : setupMode ? '保存并解锁' : '解锁'}
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-background/70 p-3 text-sm text-muted-foreground">
            {changeMode
              ? '更新后会立即覆盖当前主密码，桌面端与服务模式都使用同一份密码校验信息。'
              : setupMode
                ? '当前已启用主密码保护，但还没有初始化密码。设置后系统将进入管理员模式。'
                : '未解锁时系统保持只读模式，可以查看信息，但不能执行资产相关操作。'}
          </div>

          {changeMode ? (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">当前主密码</div>
              <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} onKeyDown={handleSubmitKeyDown} placeholder="请输入当前主密码" />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">{changeMode ? '新主密码' : '主密码'}</div>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={handleSubmitKeyDown} placeholder="至少 8 位" />
          </div>

          {(setupMode || changeMode) ? (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">确认密码</div>
              <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} onKeyDown={handleSubmitKeyDown} placeholder="请再次输入主密码" />
              {confirmPassword && password !== confirmPassword ? <div className="text-xs text-destructive">两次输入的密码不一致</div> : null}
            </div>
          ) : null}

          {!setupMode && status?.enabled ? (
            <Button variant="ghost" className="w-full" onClick={() => setChangeMode((value) => !value)}>
              {changeMode ? '返回解锁' : '修改主密码'}
            </Button>
          ) : null}
        </div>
      </Modal>
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return value
}

export function ProtectedPage({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  const { status, loading, openUnlock } = useAuth()

  if (loading || !status) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
        正在校验主密码状态...
      </div>
    )
  }

  if (!status.enabled || status.unlocked || status.needs_setup) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-border bg-card px-6">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div>
          <div className="text-xl font-semibold text-foreground">{title} 已锁定</div>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div>
        </div>
        <div className="rounded-xl border border-border bg-background/60 p-4 text-left text-sm text-muted-foreground">
          未解锁时仅保留信息浏览能力，执行、终端、连接器与系统配置页面需要先输入主密码。
        </div>
        <Button onClick={openUnlock} className="w-full">
          <Shield className="h-4 w-4" />
          输入主密码
        </Button>
      </div>
    </div>
  )
}

export function AuthStatusBadge() {
  const { status, loading, isReadOnly, openUnlock, lock } = useAuth()

  if (loading || !status || !status.enabled) return null

  return (
    <div className="flex items-center gap-2">
      <div
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
        style={{
          borderColor: isReadOnly ? 'color-mix(in srgb, #f59e0b 40%, var(--color-border))' : 'color-mix(in srgb, #10b981 32%, var(--color-border))',
          color: isReadOnly ? '#b45309' : '#047857',
          backgroundColor: isReadOnly ? 'color-mix(in srgb, #f59e0b 8%, transparent)' : 'color-mix(in srgb, #10b981 8%, transparent)',
        }}
      >
        {isReadOnly ? <ShieldAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
        {isReadOnly ? '只读模式' : '管理员模式'}
      </div>

      {isReadOnly ? (
        <Button variant="outline" size="sm" onClick={openUnlock}>解锁</Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => void lock()}>锁定</Button>
      )}
    </div>
  )
}
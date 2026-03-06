// ConfirmDialog.tsx 二次确认弹窗，用于危险操作（删除/高风险命令）
import { useState } from 'react'

interface ConfirmDialogProps {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
  children: (open: () => void) => React.ReactNode
}

export function ConfirmDialog({
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  return (
    <>
      {children(() => setOpen(true))}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 遮罩 */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={() => !loading && setOpen(false)}
          />
          {/* 弹窗 */}
          <div
            className="relative z-10 rounded-lg border p-6 w-full max-w-sm shadow-xl"
            style={{
              backgroundColor: 'var(--color-card)',
              borderColor: 'var(--color-border)',
            }}
          >
            <h3
              className="text-base font-semibold mb-2"
              style={{ color: 'var(--color-foreground)' }}
            >
              {title}
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--color-muted-foreground)' }}>
              {description}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="px-3 py-1.5 rounded-md text-sm border transition-colors"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-foreground)',
                  backgroundColor: 'transparent',
                }}
              >
                {cancelText}
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={{
                  backgroundColor: danger ? 'var(--color-destructive)' : 'var(--color-primary)',
                  color: danger ? 'var(--color-destructive-foreground)' : 'var(--color-primary-foreground)',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? '处理中...' : confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

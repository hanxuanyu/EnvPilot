// ConfirmDialog.tsx — 基于 Radix AlertDialog 的二次确认组件
import { useState } from 'react'
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent,
  AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
  children: React.ReactNode
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
      setOpen(false)
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <Button
            variant={danger ? 'destructive' : 'default'}
            loading={loading}
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

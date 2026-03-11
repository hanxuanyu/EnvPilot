import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'

import { Button, type ButtonProps } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { writeClipboardText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'

interface CopyButtonProps extends Omit<ButtonProps, 'children' | 'onClick'> {
  text: string
  label?: string
  successText?: string
  errorText?: string
}

export function CopyButton({
  text,
  label = '内容',
  successText,
  errorText,
  className,
  disabled,
  size = 'icon',
  type = 'button',
  variant = 'ghost',
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (copiedTimerRef.current != null) {
      window.clearTimeout(copiedTimerRef.current)
    }
  }, [])

  const canCopy = !disabled && text.trim().length > 0
  const tooltipText = !canCopy ? `暂无可复制${label}` : copied ? '已复制' : `复制${label}`

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (!canCopy) return

    try {
      await writeClipboardText(text)
      setCopied(true)
      if (copiedTimerRef.current != null) {
        window.clearTimeout(copiedTimerRef.current)
      }
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1500)
      toast.success(successText ?? `已复制${label}`)
    } catch {
      toast.error(errorText ?? `复制${label}失败`)
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            {...props}
            type={type}
            variant={variant}
            size={size}
            disabled={!canCopy}
            onClick={event => void handleClick(event)}
            aria-label={tooltipText}
            className={cn('shrink-0', className)}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

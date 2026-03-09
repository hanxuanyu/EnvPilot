import * as React from 'react'
import { cn } from '@/lib/utils'

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, disabled, onClick, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? 'checked' : 'unchecked'}
      disabled={disabled}
      className={cn(
        'inline-flex h-6 w-11 items-center rounded-full border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked ? 'border-primary bg-primary' : 'border-border bg-muted',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || disabled) return
        onCheckedChange?.(!checked)
      }}
      {...props}
    >
      <span
        className={cn(
          'block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  )
)

Switch.displayName = 'Switch'

export { Switch }

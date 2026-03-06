// DynamicConfigForm — 根据插件 ConfigSchema 动态渲染表单字段
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { ConfigField } from '@/types/asset'
import { cn } from '@/lib/utils'

interface DynamicFieldProps {
  field: ConfigField
  value: unknown
  onChange: (val: unknown) => void
  disabled?: boolean
}

function DynamicField({ field, value, onChange, disabled }: DynamicFieldProps) {
  const strVal = value != null && value !== undefined ? String(value) : ''

  switch (field.type) {
    case 'text':
    case 'password':
      return (
        <Input
          type={field.type === 'password' ? 'password' : 'text'}
          value={strVal}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          className={field.type === 'password' ? 'font-mono' : undefined}
        />
      )

    case 'number':
      return (
        <Input
          type="number"
          value={strVal}
          onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder={field.placeholder}
          disabled={disabled}
          className="font-mono"
        />
      )

    case 'textarea':
      return (
        <Textarea
          value={strVal}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={4}
          className="font-mono text-xs"
        />
      )

    case 'boolean':
      return (
        <div className="flex items-center h-9 gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(value)}
            disabled={disabled}
            onClick={() => onChange(!value)}
            className={cn(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              Boolean(value) ? 'bg-primary' : 'bg-input',
            )}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
                Boolean(value) ? 'translate-x-4' : 'translate-x-0.5',
              )}
            />
          </button>
          <span className="text-sm text-muted-foreground">
            {Boolean(value) ? '已启用' : '已禁用'}
          </span>
        </div>
      )

    case 'select':
      return (
        <Select
          value={strVal || '__empty__'}
          onValueChange={v => onChange(v === '__empty__' ? '' : v)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder || '请选择'} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map(opt => (
              <SelectItem key={opt.value} value={opt.value || '__empty__'}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )

    default:
      return (
        <Input
          value={strVal}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
        />
      )
  }
}

// ── 主组件 ──

interface DynamicConfigFormProps {
  schema: ConfigField[]
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
  disabled?: boolean
}

export function DynamicConfigForm({ schema, value, onChange, disabled }: DynamicConfigFormProps) {
  if (!schema || schema.length === 0) return null

  const handleFieldChange = (key: string, val: unknown) => {
    onChange({ ...value, [key]: val })
  }

  return (
    <div className="space-y-3">
      {schema.map(field => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={`field-${field.key}`} className="text-xs font-medium">
            {field.label}
            {field.required && (
              <span className="text-destructive ml-0.5">*</span>
            )}
          </Label>
          <DynamicField
            field={field}
            value={value[field.key] ?? field.default_val ?? ''}
            onChange={val => handleFieldChange(field.key, val)}
            disabled={disabled}
          />
          {field.description && (
            <p className="text-[11px] text-muted-foreground">{field.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}

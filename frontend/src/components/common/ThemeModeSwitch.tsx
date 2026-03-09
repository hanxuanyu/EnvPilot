import { LaptopMinimal, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemeMode } from '@/lib/theme'

const THEME_OPTIONS: Array<{
  mode: ThemeMode
  label: string
  icon: typeof Sun
  offset: number
}> = [
  { mode: 'light', label: '浅色', icon: Sun, offset: 0 },
  { mode: 'system', label: '跟随系统', icon: LaptopMinimal, offset: 24 },
  { mode: 'dark', label: '深色', icon: Moon, offset: 48 },
]

const COLLAPSED_OFFSET: Record<ThemeMode, number> = {
  light: 0,
  system: -24,
  dark: -48,
}

export function ThemeModeSwitch() {
  const { mode, setMode } = useTheme()
  const current = THEME_OPTIONS.find((option) => option.mode === mode) ?? THEME_OPTIONS[1]

  return (
    <div
      className="theme-mode-switch"
      data-mode={mode}
      aria-label="主题模式切换"
      style={{ ['--theme-switch-offset' as string]: `${current.offset}px` }}
    >
      <div
        className="theme-mode-switch__track"
        style={{ transform: `translateX(${COLLAPSED_OFFSET[mode]}px)` }}
      >
        <div className="theme-mode-switch__indicator" aria-hidden="true" />
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon
          const active = option.mode === mode
          return (
            <button
              key={option.mode}
              type="button"
              onClick={() => setMode(option.mode)}
              className="theme-mode-switch__option"
              data-active={active ? 'true' : 'false'}
              title={option.label}
              aria-label={option.label}
              aria-pressed={active}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

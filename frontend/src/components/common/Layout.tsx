// Layout.tsx 主应用布局：左侧固定侧边栏 + 右侧内容区（支持滚动）
import { useEffect, useMemo, useState } from 'react'
import { Search, Sparkles, ChevronRight } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { ThemeModeSwitch } from './ThemeModeSwitch'
import { Button } from '@/components/ui/button'
import { GlobalCommandPalette } from './GlobalCommandPalette'
import { AuthStatusBadge } from './AuthProvider'
import { findRouteMeta, getBreadcrumbs } from './navigation'

export function Layout() {
  const location = useLocation()
  const routeMeta = useMemo(() => findRouteMeta(location.pathname), [location.pathname])
  const breadcrumbs = useMemo(() => getBreadcrumbs(routeMeta), [routeMeta])
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTypingTarget = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandQuery('')
        setCommandPaletteOpen(true)
        return
      }

      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isTypingTarget) {
        event.preventDefault()
        setCommandQuery('')
        setCommandPaletteOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    setCommandPaletteOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* 固定侧边栏 */}
      <Sidebar />

      {/* 主内容区域 */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* 顶部标题栏 */}
        <div
          className="flex h-[var(--layout-header-height)] items-center gap-4 border-b px-6"
          style={{
            backgroundColor: 'var(--color-card)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>{routeMeta.title}</div>
            <div className="mt-1 truncate text-xs" style={{ color: 'var(--color-muted-foreground)' }}>{routeMeta.description}</div>
            <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
              {breadcrumbs.map((item, index) => (
                <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 ? <ChevronRight className="h-3 w-3 shrink-0" /> : null}
                  {item.to ? (
                    <Link to={item.to} className="truncate transition-colors hover:text-foreground">
                      {item.label}
                    </Link>
                  ) : (
                    <span className="truncate">{item.label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeModeSwitch />
            <AuthStatusBadge />

            {routeMeta.actions.slice(0, 2).map((action) => (
              <Button key={action.to} asChild variant="outline" size="sm" className="hidden xl:inline-flex">
                <Link to={action.to}>{action.label}</Link>
              </Button>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="打开全局搜索"
              onClick={() => {
                setCommandQuery('')
                setCommandPaletteOpen(true)
              }}
              className="min-w-[132px] justify-between"
            >
              <span className="inline-flex items-center gap-2">
                <Search className="h-4 w-4" />
                <span>全局搜索</span>
              </span>
              <span
                className="hidden shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] lg:inline-flex"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted-foreground)' }}
              >
                <Sparkles className="h-3 w-3" />
                <span>Cmd/Ctrl + K</span>
              </span>
            </Button>
          </div>
        </div>

        {/* 页面内容区，支持滚动 */}
        <div className="flex-1 min-h-0 min-w-0 overflow-auto p-6">
          <div className="h-full min-w-0">
            <Outlet />
          </div>
        </div>
      </main>

      <GlobalCommandPalette
        open={commandPaletteOpen}
        query={commandQuery}
        onQueryChange={setCommandQuery}
        onOpenChange={setCommandPaletteOpen}
      />
    </div>
  )
}

// Sidebar.tsx 主导航侧边栏
// 包含所有功能模块的导航入口，使用 react-router-dom 管理激活状态
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { getVersion, type VersionInfo } from '@/services/backendService'
import { IS_SERVER_MODE } from '@/lib/apiClient'
import { navGroups } from './navigation'
import {
  GitCommitHorizontal,
  Wifi,
} from 'lucide-react'

export function Sidebar() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const shortCommit = versionInfo?.commit ? versionInfo.commit.slice(0, 7) : 'unknown'

  useEffect(() => {
    let cancelled = false

    const loadVersion = async () => {
      try {
        const version = await getVersion()
        if (!cancelled) {
          setVersionInfo(version)
        }
      } catch {
        if (!cancelled) {
          setVersionInfo(null)
        }
      }
    }

    loadVersion()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <aside
      className="flex flex-col w-56 h-full border-r select-none"
      style={{
        backgroundColor: 'var(--color-sidebar)',
        borderColor: 'var(--color-sidebar-border)',
      }}
    >
      {/* Logo 区域 */}
      <div
        className="flex h-[var(--layout-header-height)] items-center gap-2 border-b px-4"
        style={{ borderColor: 'var(--color-sidebar-border)' }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-md"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <Wifi className="w-4 h-4" style={{ color: 'var(--color-primary-foreground)' }} />
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
            EnvPilot
          </div>
          <div className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
            运维管理工具
          </div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navGroups.map((group) => (
          <div key={group.group} className="mb-1">
            {/* 分组标题 */}
            <div
              className="px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {group.group}
            </div>
            {/* 导航项 */}
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 mx-2 px-3 py-2 rounded-md text-sm transition-colors',
                    isActive ? 'nav-active' : 'nav-inactive'
                  )
                }
                style={({ isActive }) => ({
                  backgroundColor: isActive ? 'var(--color-sidebar-accent)' : 'transparent',
                  color: isActive
                    ? 'var(--color-sidebar-accent-foreground)'
                    : 'var(--color-sidebar-foreground)',
                  fontWeight: isActive ? '500' : 'normal',
                })}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* 底部版本信息 */}
      <div
        className="px-4 py-2.5 border-t"
        style={{
          borderColor: 'var(--color-sidebar-border)',
          color: 'var(--color-muted-foreground)',
        }}
      >
        <div className="flex items-center justify-between gap-2 text-[10px]" style={{ color: 'var(--color-sidebar-foreground)' }}>
          <div className="flex min-w-0 items-center gap-1.5 font-medium">
            <GitCommitHorizontal className="h-3 w-3 shrink-0" />
            <span className="shrink-0">{versionInfo?.version ?? 'dev'}</span>
            <span className="opacity-45">·</span>
            <span className="truncate font-mono opacity-75">{shortCommit}</span>
          </div>
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-sidebar-accent) 88%, transparent)',
              color: 'var(--color-sidebar-foreground)',
            }}
          >
            {IS_SERVER_MODE ? 'srv' : 'desk'}
          </span>
        </div>
      </div>
    </aside>
  )
}

// Sidebar.tsx 主导航侧边栏
// 包含所有功能模块的导航入口，使用 react-router-dom 管理激活状态
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Server,
  Terminal,
  Database,
  Wifi,
  Activity,
  ClipboardList,
  Settings,
  Globe,
  Layers,
} from 'lucide-react'

// 导航分组与页面路由定义
const navItems = [
  {
    group: '概览',
    items: [
      { path: '/', label: '仪表盘', icon: LayoutDashboard },
    ],
  },
  {
    group: '资产管理',
    items: [
      { path: '/assets', label: '资产列表', icon: Server },
      { path: '/environments', label: '环境管理', icon: Layers },
    ],
  },
  {
    group: '运维操作',
    items: [
      { path: '/executor', label: '命令执行', icon: Terminal },
      { path: '/terminal', label: '在线终端', icon: Terminal },
      { path: '/connector', label: '中间件', icon: Database },
    ],
  },
  {
    group: '基础设施',
    items: [
      { path: '/dns', label: 'DNS 管理', icon: Globe },
      { path: '/health', label: '健康检查', icon: Activity },
    ],
  },
  {
    group: '系统',
    items: [
      { path: '/audit', label: '操作审计', icon: ClipboardList },
      { path: '/config', label: '系统配置', icon: Settings },
    ],
  },
]

export function Sidebar() {
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
        className="flex items-center gap-2 px-4 py-4 border-b"
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
        {navItems.map((group) => (
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
        className="px-4 py-3 border-t"
        style={{
          borderColor: 'var(--color-sidebar-border)',
          color: 'var(--color-muted-foreground)',
        }}
      >
        <div className="text-[10px]">v0.1.0 · 本地运行</div>
      </div>
    </aside>
  )
}

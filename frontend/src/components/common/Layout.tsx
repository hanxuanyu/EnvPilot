// Layout.tsx 主应用布局：左侧固定侧边栏 + 右侧内容区（支持滚动）
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* 固定侧边栏 */}
      <Sidebar />

      {/* 主内容区域 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部标题栏 */}
        <div
          className="flex items-center h-12 px-6 border-b"
          style={{
            backgroundColor: 'var(--color-card)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div id="page-header-portal" className="flex-1" />
        </div>

        {/* 页面内容区，支持滚动 */}
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

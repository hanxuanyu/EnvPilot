// App.tsx 前端应用根组件，配置路由系统
import { Suspense, lazy } from 'react'
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from '@/components/common/Layout'
import { useWailsReady } from '@/hooks/useWailsReady'
import { IS_SERVER_MODE } from '@/lib/apiClient'
import { ThemeProvider, useTheme } from '@/lib/theme'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const EnvironmentPage = lazy(() => import('@/pages/EnvironmentPage'))
const AssetPage = lazy(() => import('@/pages/AssetPage'))
const ExecutorPage = lazy(() => import('@/pages/ExecutorPage'))
const TerminalPage = lazy(() => import('@/pages/TerminalPage'))
const ConnectorPage = lazy(() => import('@/pages/ConnectorPage'))
const DnsPage = lazy(() => import('@/pages/DnsPage'))
const HealthPage = lazy(() => import('@/pages/HealthPage'))
const AuditPage = lazy(() => import('@/pages/AuditPage'))
const ConfigPage = lazy(() => import('@/pages/ConfigPage'))

// 桥接就绪前的全屏加载占位
function BridgeLoading() {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400">连接后端服务…</span>
      </div>
    </div>
  )
}

function RouteLoading() {
  return (
    <div className="flex min-h-[240px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-7 w-7 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>页面模块加载中…</span>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  )
}

function AppShell() {
  // 等待 Wails 桥接就绪后再渲染页面，避免刷新后数据为空
  const wailsReady = useWailsReady()
  const Router = IS_SERVER_MODE ? BrowserRouter : HashRouter
  const { resolvedTheme } = useTheme()

  return (
    <Router>
      {/* Sonner Toast 容器，放在最外层确保全局可用 */}
      <Toaster
        position="top-right"
        theme={resolvedTheme}
        richColors
        closeButton
        toastOptions={{
          style: {
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-foreground)',
          },
        }}
      />
      {!wailsReady ? (
        <BridgeLoading />
      ) : (
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            {/* 所有页面共享主布局（侧边栏 + 内容区） */}
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="environments" element={<EnvironmentPage />} />
              <Route path="assets" element={<AssetPage />} />
              <Route path="executor" element={<ExecutorPage />} />
              <Route path="terminal" element={<TerminalPage />} />
              <Route path="terminal/:assetId" element={<TerminalPage />} />
              <Route path="connector" element={<ConnectorPage />} />
              <Route path="connector/:type" element={<ConnectorPage />} />
              <Route path="dns" element={<DnsPage />} />
              <Route path="health" element={<HealthPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="config" element={<ConfigPage />} />
            </Route>
          </Routes>
        </Suspense>
      )}
    </Router>
  )
}

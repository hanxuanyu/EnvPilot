// App.tsx 前端应用根组件，配置路由系统
import { Suspense, lazy } from 'react'
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, ProtectedPage } from '@/components/common/AuthProvider'
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
        <AuthProvider>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              {/* 所有页面共享主布局（侧边栏 + 内容区） */}
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="environments" element={<EnvironmentPage />} />
                <Route path="assets" element={<AssetPage />} />
                <Route path="executor" element={<ProtectedPage title="命令执行" description="命令执行会直接对资产发起操作，未解锁时不开放页面。"><ExecutorPage /></ProtectedPage>} />
                <Route path="terminal" element={<ProtectedPage title="在线终端" description="终端会话具备实时控制能力，必须先通过主密码解锁。"><TerminalPage /></ProtectedPage>} />
                <Route path="terminal/:assetId" element={<ProtectedPage title="在线终端" description="终端会话具备实时控制能力，必须先通过主密码解锁。"><TerminalPage /></ProtectedPage>} />
                <Route path="connector" element={<ProtectedPage title="中间件连接器" description="连接器支持探测、查询与消息发送，属于受保护的操作页面。"><ConnectorPage /></ProtectedPage>} />
                <Route path="connector/:type" element={<ProtectedPage title="中间件连接器" description="连接器支持探测、查询与消息发送，属于受保护的操作页面。"><ConnectorPage /></ProtectedPage>} />
                <Route path="dns" element={<DnsPage />} />
                <Route path="health" element={<HealthPage />} />
                <Route path="audit" element={<ProtectedPage title="操作审计" description="审计记录包含敏感的执行与变更轨迹，需要先解锁后查看。"><AuditPage /></ProtectedPage>} />
                <Route path="config" element={<ProtectedPage title="系统配置" description="系统配置涉及运行参数和密码管理，必须先解锁后查看。"><ConfigPage /></ProtectedPage>} />
              </Route>
            </Routes>
          </Suspense>
        </AuthProvider>
      )}
    </Router>
  )
}

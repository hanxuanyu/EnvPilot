// App.tsx 前端应用根组件，配置路由系统
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from '@/components/common/Layout'
import Dashboard from '@/pages/Dashboard'
import EnvironmentPage from '@/pages/EnvironmentPage'
import AssetPage from '@/pages/AssetPage'
import ExecutorPage from '@/pages/ExecutorPage'
import TerminalPage from '@/pages/TerminalPage'
import ConnectorPage from '@/pages/ConnectorPage'
import DnsPage from '@/pages/DnsPage'
import HealthPage from '@/pages/HealthPage'
import AuditPage from '@/pages/AuditPage'
import ConfigPage from '@/pages/ConfigPage'
import { useWailsReady } from '@/hooks/useWailsReady'

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

export default function App() {
  // 等待 Wails 桥接就绪后再渲染页面，避免刷新后数据为空
  const wailsReady = useWailsReady()

  return (
    <BrowserRouter>
      {/* Sonner Toast 容器，放在最外层确保全局可用 */}
      <Toaster
        position="top-right"
        theme="dark"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: 'hsl(222 47% 8%)',
            border: '1px solid hsl(217 32% 17%)',
            color: 'hsl(210 40% 98%)',
          },
        }}
      />
      {!wailsReady ? (
        <BridgeLoading />
      ) : (
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
      )}
    </BrowserRouter>
  )
}

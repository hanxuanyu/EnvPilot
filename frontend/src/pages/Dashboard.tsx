// Dashboard.tsx 仪表盘首页（含后端通信验证）
import { useState, useEffect } from 'react'
import { Server, Database, Activity, ClipboardList, CheckCircle2, XCircle } from 'lucide-react'
import { ping, getVersion, type VersionInfo } from '@/services/backendService'

const stats = [
  { label: '服务器资产', value: '0', icon: Server, color: '#60a5fa' },
  { label: '中间件资产', value: '0', icon: Database, color: '#c084fc' },
  { label: '健康检查', value: '0 / 0', icon: Activity, color: '#4ade80' },
  { label: '今日操作', value: '0', icon: ClipboardList, color: '#facc15' },
]

export default function Dashboard() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'error'>('checking')
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)

  useEffect(() => {
    // 应用启动时验证后端通信
    const checkBackend = async () => {
      try {
        const pong = await ping()
        if (pong === 'pong') {
          setBackendStatus('ok')
          const ver = await getVersion()
          setVersionInfo(ver)
        } else {
          setBackendStatus('error')
        }
      } catch {
        // 在浏览器预览模式下后端不可用，属于正常情况
        setBackendStatus('error')
      }
    }
    checkBackend()
  }, [])

  return (
    <div className="space-y-6" style={{ animation: 'var(--animate-fade-in)' }}>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-foreground)' }}>
            仪表盘
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
            EnvPilot 运维管理总览
          </p>
        </div>

        {/* 后端连接状态指示 */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs border"
          style={{
            backgroundColor: 'var(--color-card)',
            borderColor: 'var(--color-border)',
            color: backendStatus === 'ok' ? '#4ade80' : backendStatus === 'error' ? '#f87171' : 'var(--color-muted-foreground)',
          }}
        >
          {backendStatus === 'ok' ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>后端已连接 · {versionInfo?.version ?? ''}</span>
            </>
          ) : backendStatus === 'error' ? (
            <>
              <XCircle className="w-3.5 h-3.5" />
              <span>后端未连接</span>
            </>
          ) : (
            <span>检测中...</span>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg p-4 space-y-3 border"
            style={{
              backgroundColor: 'var(--color-card)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                {stat.label}
              </span>
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
            </div>
            <div className="text-2xl font-semibold" style={{ color: 'var(--color-foreground)' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* 快速入口说明 */}
      <div
        className="rounded-lg p-6 border"
        style={{
          backgroundColor: 'var(--color-card)',
          borderColor: 'var(--color-border)',
        }}
      >
        <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--color-foreground)' }}>
          开始使用
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          请先在「资产列表」中添加服务器和中间件资产，然后开始使用各项运维功能。
        </p>
      </div>
    </div>
  )
}

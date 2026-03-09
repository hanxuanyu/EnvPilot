import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isServer = mode === 'server'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@wailsjs': path.resolve(__dirname, './wailsjs'),
      },
    },
    // 向前端代码注入构建模式常量
    define: {
      // 'desktop' | 'server'
      __APP_MODE__: JSON.stringify(isServer ? 'server' : 'desktop'),
      // 服务端模式的 API 基础路径（可在部署时通过 .env 覆盖）
      __API_BASE__: JSON.stringify(isServer ? '' : ''),
    },
    build: {
      // 桌面模式输出到 dist（Wails 内嵌），服务端模式输出到 dist-server
      outDir: isServer ? 'dist-server' : 'dist',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@xterm')) return 'vendor-xterm'
              if (id.includes('@radix-ui') || id.includes('sonner')) return 'vendor-ui'
              if (id.includes('react-router')) return 'vendor-router'
              if (id.includes('react-dom') || /node_modules\/react\//.test(id)) return 'vendor-react'
              if (id.includes('zustand')) return 'vendor-state'
              if (id.includes('lucide-react')) return 'vendor-icons'
              return 'vendor-misc'
            }

            if (id.includes('/src/pages/TerminalPage')) return 'page-terminal'
            if (id.includes('/src/pages/ConnectorPage')) return 'page-connector'
            if (id.includes('/src/pages/ConfigPage')) return 'page-config'
            if (id.includes('/src/pages/AssetPage') || id.includes('/src/pages/EnvironmentPage')) return 'page-assets'
            if (id.includes('/src/pages/DnsPage') || id.includes('/src/pages/HealthPage')) return 'page-infra'
            if (id.includes('/src/pages/ExecutorPage') || id.includes('/src/pages/AuditPage')) return 'page-ops'
          },
        },
      },
    },
    // 服务端开发调试时代理到后端 Go 服务（避免 CORS）
    ...(isServer && {
      server: {
        proxy: {
          '/api': 'http://localhost:8080',
          '/ws': { target: 'ws://localhost:8080', ws: true },
        },
      },
    }),
  }
})

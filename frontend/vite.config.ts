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

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const MODERN_CSS_TARGET = ['chrome120', 'edge120', 'firefox121', 'safari17']

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
      // 桌面模式输出到 dist，服务端模式输出到 dist-server，便于两套产物并存
      outDir: isServer ? 'dist-server' : 'dist',
      // 当前 Vite 3 + TailwindCSS v4 组合在 esbuild 压缩阶段会错误改写
      // 响应式工具类，直接导致服务端产物布局异常，因此先关闭压缩。
      minify: false,
      // TailwindCSS v4 会生成现代 CSS（嵌套、color-mix 等），旧默认目标会让 esbuild
      // 在压缩时错误改写响应式工具类，导致服务端产物布局错乱。
      cssTarget: MODERN_CSS_TARGET,
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes(`'use client'`)) {
            return
          }
          warn(warning)
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

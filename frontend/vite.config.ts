import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // @/ 指向 src 目录，简化导入路径
      '@': path.resolve(__dirname, './src'),
      // @wailsjs/ 指向 Wails 自动生成的绑定目录，避免相对路径错误
      '@wailsjs': path.resolve(__dirname, './wailsjs'),
    },
  },
})

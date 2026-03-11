// main.tsx 前端入口文件
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installWailsBridgeMonitor } from '@/lib/wailsBridge'
import './index.css'

installWailsBridgeMonitor()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

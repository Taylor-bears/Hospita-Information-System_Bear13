import React, { Suspense, useEffect } from 'react'
import { HashRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import zhCN from 'antd/locale/zh_CN'
import 'antd/dist/reset.css'
import './App.css'

import AppRouter from './router'
import ErrorBoundary from './components/ErrorBoundary'
import { useAuthStore } from './stores/authStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  useEffect(() => {
    const path = window.location.pathname.toLowerCase()
    const hasHash = !!window.location.hash
    const toHash = (p: string) => { window.location.hash = p }
    if (!hasHash) {
      if (path === '/login' || path === '/admin/login' || path === '/patient/login' || path === '/doctor/login' || path === '/pharmacy/login') {
        toHash('/login')
      } else if (path === '/register' || path === '/patient/register') {
        toHash('/register')
      } else if (path === '/' || path === '') {
        toHash('/login')
      }
    }
  }, [])
  return (
    <ConfigProvider locale={zhCN}>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <Suspense fallback={
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              height: '100vh',
              fontSize: '16px',
              color: '#666'
            }}>
              加载中...
            </div>
          }>
            <ErrorBoundary>
              <AppRouter />
            </ErrorBoundary>
          </Suspense>
        </HashRouter>
      </QueryClientProvider>
    </ConfigProvider>
  )
}

export default App

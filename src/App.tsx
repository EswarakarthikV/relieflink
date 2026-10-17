import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/routes'
import { AuthProvider } from '@/hooks/useAuth'
import { SplashScreen } from '@/components/layout/SplashScreen'

export default function App() {
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return !sessionStorage.getItem('relieflink_splash_seen')
    } catch {
      return true
    }
  })

  const handleSplashFinish = () => {
    setShowSplash(false)
    try {
      sessionStorage.setItem('relieflink_splash_seen', 'true')
    } catch {
      // ignore
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}


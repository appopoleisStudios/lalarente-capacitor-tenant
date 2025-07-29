'use client'

import { Inter } from 'next/font/google'
import './globals.css'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { useMobile } from '@/hooks/useMobile'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { initialize, setUser, setProfile, fetchProfile } = useAuthStore()
  const { isNative } = useMobile()

  useEffect(() => {
    // Load Font Awesome
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
    document.head.appendChild(link)

    // Initialize auth state
    initialize()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [initialize, setUser, setProfile, fetchProfile])

  // Mobile-specific initialization
  useEffect(() => {
    if (isNative) {
      // Add mobile-specific class for styling
      document.body.classList.add('mobile-app')
      
      // Prevent zoom on mobile devices
      const viewport = document.querySelector('meta[name="viewport"]')
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      }
      
      // Disable text selection on mobile for better UX
      document.body.style.webkitUserSelect = 'none'
      document.body.style.userSelect = 'none'
      
      // Handle safe area for notched devices
      document.documentElement.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top)')
      document.documentElement.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom)')
      document.documentElement.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left)')
      document.documentElement.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right)')
      
    } else {
      // Remove mobile-specific class for web
      document.body.classList.remove('mobile-app')
      
      // Re-enable text selection for web
      document.body.style.webkitUserSelect = 'auto'
      document.body.style.userSelect = 'auto'
    }
  }, [isNative])

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content="#16a34a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Lala Rente" />
      </head>
      <body className={`${inter.className} ${isNative ? 'mobile-app' : ''}`}>
        {children}
      </body>
    </html>
  )
}

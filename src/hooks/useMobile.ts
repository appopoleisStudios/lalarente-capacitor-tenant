// hooks/useMobile.ts
'use client'

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'

export const useMobile = () => {
  const [isNative, setIsNative] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initializeMobile = async () => {
      try {
        // Check if running on native platform
        const native = Capacitor.isNativePlatform()
        setIsNative(native)

        if (native) {
          // Configure status bar for mobile
          await StatusBar.setStyle({ style: Style.Dark })
          await StatusBar.setBackgroundColor({ color: '#16a34a' })
          
          // Hide splash screen after initialization
          await SplashScreen.hide()
          
          // Prevent screen timeout
          if (Capacitor.getPlatform() === 'android') {
            // Android-specific configurations
            console.log('Android platform detected')
          } else if (Capacitor.getPlatform() === 'ios') {
            // iOS-specific configurations
            console.log('iOS platform detected')
          }
        }
        
        setIsInitialized(true)
      } catch (error) {
        console.error('Error initializing mobile features:', error)
        setIsInitialized(true)
      }
    }

    initializeMobile()
  }, [])

  return { 
    isNative, 
    isInitialized,
    platform: Capacitor.getPlatform(),
    isAndroid: Capacitor.getPlatform() === 'android',
    isIOS: Capacitor.getPlatform() === 'ios'
  }
}

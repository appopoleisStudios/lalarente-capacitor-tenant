// hooks/useMobile.ts
'use client'

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { KeepAwake } from '@capacitor-community/keep-awake'

export const useMobile = () => {
  const [isNative, setIsNative] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isKeepAwakeEnabled, setIsKeepAwakeEnabled] = useState(false)

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
          try {
            if (Capacitor.getPlatform() === 'android') {
              // Android-specific configurations
              await KeepAwake.keepAwake()
              setIsKeepAwakeEnabled(true)
              console.log('Android platform detected - Keep awake enabled')
            } else if (Capacitor.getPlatform() === 'ios') {
              // iOS-specific configurations
              await KeepAwake.keepAwake()
              setIsKeepAwakeEnabled(true)
              console.log('iOS platform detected - Keep awake enabled')
            }
          } catch (keepAwakeError) {
            console.warn('Keep awake feature not available:', keepAwakeError)
            // Continue without keep awake - not critical
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

  // Function to allow screen to sleep
  const allowSleep = async () => {
    if (isNative && isKeepAwakeEnabled) {
      try {
        await KeepAwake.allowSleep()
        setIsKeepAwakeEnabled(false)
        console.log('Screen sleep allowed')
      } catch (error) {
        console.warn('Error allowing sleep:', error)
      }
    }
  }

  // Function to keep screen awake
  const keepAwake = async () => {
    if (isNative && !isKeepAwakeEnabled) {
      try {
        await KeepAwake.keepAwake()
        setIsKeepAwakeEnabled(true)
        console.log('Keep awake enabled')
      } catch (error) {
        console.warn('Error enabling keep awake:', error)
      }
    }
  }

  return { 
    isNative, 
    isInitialized,
    isKeepAwakeEnabled,
    platform: Capacitor.getPlatform(),
    isAndroid: Capacitor.getPlatform() === 'android',
    isIOS: Capacitor.getPlatform() === 'ios',
    allowSleep,
    keepAwake
  }
}

import { Capacitor } from '@capacitor/core'
import { KeepAwake } from '@capacitor-community/keep-awake'

/**
 * Test utility for Keep Awake functionality
 * This helps verify that the keep-awake plugin is working correctly
 */

export async function testKeepAwake() {
  try {
    console.log('🧪 Testing Keep Awake functionality...')
    
    // Check if running on native platform
    if (!Capacitor.isNativePlatform()) {
      console.log('⚠️  Not running on native platform - keep awake not available')
      return { success: false, message: 'Not on native platform' }
    }

    const platform = Capacitor.getPlatform()
    console.log(`📱 Platform detected: ${platform}`)

    // Test keep awake
    console.log('🔒 Enabling keep awake...')
    await KeepAwake.keepAwake()
    console.log('✅ Keep awake enabled successfully')

    // Wait a moment to verify it's working
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Test allow sleep
    console.log('😴 Allowing sleep...')
    await KeepAwake.allowSleep()
    console.log('✅ Sleep allowed successfully')

    return { 
      success: true, 
      message: 'Keep awake functionality working correctly',
      platform 
    }

  } catch (error) {
    console.error('❌ Keep awake test failed:', error)
    return { 
      success: false, 
      message: 'Keep awake test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Check if keep awake is available
 */
export function isKeepAwakeAvailable(): boolean {
  return Capacitor.isNativePlatform() && 
         (Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios')
}

/**
 * Get keep awake status
 */
export function getKeepAwakeStatus() {
  return {
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
    isAvailable: isKeepAwakeAvailable(),
    isAndroid: Capacitor.getPlatform() === 'android',
    isIOS: Capacitor.getPlatform() === 'ios'
  }
} 
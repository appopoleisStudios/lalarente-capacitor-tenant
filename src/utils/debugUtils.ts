// Debug utilities for testing profile fetch functionality

import { supabase } from '@/lib/supabase'

/**
 * Test function to check if a user profile exists in the database
 */
export async function testProfileExists(userId: string) {
  try {
    console.log('Testing profile existence for user:', userId)
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.log('Profile test result:', { exists: false, error: error.message, code: error.code })
      return { exists: false, error }
    }
    
    console.log('Profile test result:', { exists: true, data })
    return { exists: true, data }
  } catch (error) {
    console.log('Profile test error:', error)
    return { exists: false, error }
  }
}

/**
 * Test function to simulate the profile fetch process
 */
export async function testProfileFetch(userId: string) {
  console.log('=== Profile Fetch Test ===')
  console.log('User ID:', userId)
  
  // Test 1: Check if profile exists
  const existenceTest = await testProfileExists(userId)
  
  // Test 2: Try to fetch profile with retries
  if (existenceTest.exists) {
    console.log('Profile exists, testing fetch...')
    
    let retries = 3
    while (retries > 0) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()
        
        if (error) {
          console.log(`Fetch attempt ${4 - retries} failed:`, error.message)
          retries--
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        } else {
          console.log('Profile fetch successful:', data)
          return { success: true, data }
        }
      } catch (error) {
        console.log(`Fetch attempt ${4 - retries} error:`, error)
        retries--
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
    
    console.log('All fetch attempts failed')
    return { success: false, error: 'All retries exhausted' }
  } else {
    console.log('Profile does not exist in database')
    return { success: false, error: 'Profile not found' }
  }
} 
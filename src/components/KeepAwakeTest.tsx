'use client'

import React, { useState } from 'react'
import { useMobile } from '@/hooks/useMobile'
import { testKeepAwake, getKeepAwakeStatus } from '@/utils/keepAwakeTest'

/**
 * Test component for Keep Awake functionality
 * This component allows testing the keep-awake feature in development
 */

const KeepAwakeTest: React.FC = () => {
  const { isNative, isKeepAwakeEnabled, platform, allowSleep, keepAwake } = useMobile()
  const [testResult, setTestResult] = useState<string>('')
  const [isTesting, setIsTesting] = useState(false)

  const handleTest = async () => {
    setIsTesting(true)
    setTestResult('Testing...')
    
    try {
      const result = await testKeepAwake()
      setTestResult(result.success ? '✅ Test passed!' : `❌ Test failed: ${result.message}`)
    } catch (error) {
      setTestResult(`❌ Test error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsTesting(false)
    }
  }

  const handleToggleKeepAwake = async () => {
    if (isKeepAwakeEnabled) {
      await allowSleep()
    } else {
      await keepAwake()
    }
  }

  const status = getKeepAwakeStatus()

  if (!isNative) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg">
        <h3 className="font-semibold text-gray-700">Keep Awake Test</h3>
        <p className="text-sm text-gray-600">
          This feature is only available on native mobile platforms (Android/iOS)
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Current platform: {platform}
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <h3 className="font-semibold text-blue-800 mb-3">Keep Awake Test</h3>
      
      <div className="space-y-3">
        {/* Status Information */}
        <div className="text-sm">
          <p><strong>Platform:</strong> {platform}</p>
          <p><strong>Keep Awake Enabled:</strong> {isKeepAwakeEnabled ? '✅ Yes' : '❌ No'}</p>
          <p><strong>Available:</strong> {status.isAvailable ? '✅ Yes' : '❌ No'}</p>
        </div>

        {/* Test Button */}
        <button
          onClick={handleTest}
          disabled={isTesting}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isTesting ? 'Testing...' : 'Run Keep Awake Test'}
        </button>

        {/* Toggle Button */}
        <button
          onClick={handleToggleKeepAwake}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 ml-2"
        >
          {isKeepAwakeEnabled ? 'Allow Sleep' : 'Keep Awake'}
        </button>

        {/* Test Result */}
        {testResult && (
          <div className="mt-3 p-2 bg-gray-100 rounded text-sm">
            <strong>Test Result:</strong> {testResult}
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-gray-600 mt-3">
          <p><strong>Instructions:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Run the test to verify keep-awake functionality</li>
            <li>Use toggle button to enable/disable keep-awake</li>
            <li>Check if screen stays on when keep-awake is enabled</li>
            <li>Verify screen can sleep when keep-awake is disabled</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default KeepAwakeTest 
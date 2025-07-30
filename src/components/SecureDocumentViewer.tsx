'use client'

import React, { useState, useEffect } from 'react'
import { getSecureDocumentUrl } from '@/utils/secureDocuments'

interface SecureDocumentViewerProps {
  filePath: string
  fileName?: string
  className?: string
  onError?: (error: string) => void
  onLoad?: () => void
}

/**
 * Secure Document Viewer Component
 * 
 * This component displays documents using signed URLs to ensure
 * secure access to sensitive FICA documents and other private files.
 * 
 * Features:
 * - Uses signed URLs with expiry (1 hour by default)
 * - Handles loading states
 * - Error handling for access denied or expired URLs
 * - Automatic URL refresh when needed
 */
const SecureDocumentViewer: React.FC<SecureDocumentViewerProps> = ({
  filePath,
  fileName,
  className = '',
  onError,
  onLoad
}) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [urlExpiry, setUrlExpiry] = useState<Date | null>(null)

  // Generate signed URL for document access
  const generateSignedUrl = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const result = await getSecureDocumentUrl(filePath)
      
      if (result.error) {
        setError(result.error)
        onError?.(result.error)
        return
      }

      setSignedUrl(result.url)
      
      // Set expiry time (1 hour from now)
      const expiry = new Date()
      expiry.setHours(expiry.getHours() + 1)
      setUrlExpiry(expiry)
      
      onLoad?.()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load document'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Check if URL needs refresh (expired or about to expire)
  const needsRefresh = () => {
    if (!urlExpiry) return true
    const now = new Date()
    const timeUntilExpiry = urlExpiry.getTime() - now.getTime()
    // Refresh if URL expires in less than 5 minutes
    return timeUntilExpiry < 5 * 60 * 1000
  }

  // Load document on mount and refresh when needed
  useEffect(() => {
    if (filePath) {
      generateSignedUrl()
    }
  }, [filePath])

  // Auto-refresh URL before expiry
  useEffect(() => {
    if (!signedUrl || !urlExpiry) return

    const checkExpiry = () => {
      if (needsRefresh()) {
        generateSignedUrl()
      }
    }

    // Check every minute
    const interval = setInterval(checkExpiry, 60 * 1000)
    return () => clearInterval(interval)
  }, [signedUrl, urlExpiry])

  // Handle PDF display
  const renderPDF = () => (
    <iframe
      src={`${signedUrl}#toolbar=0&navpanes=0&scrollbar=0`}
      className="w-full h-full border-0"
      title={fileName || 'Document'}
      onLoad={() => setIsLoading(false)}
      onError={() => {
        setError('Failed to load PDF')
        setIsLoading(false)
      }}
    />
  )

  // Handle image display
  const renderImage = () => (
    <img
      src={signedUrl || undefined}
      alt={fileName || 'Document'}
      className="w-full h-full object-contain"
      onLoad={() => setIsLoading(false)}
      onError={() => {
        setError('Failed to load image')
        setIsLoading(false)
      }}
    />
  )

  // Determine file type and render appropriately
  const renderDocument = () => {
    if (!signedUrl) return null

    const fileExtension = filePath.split('.').pop()?.toLowerCase()
    
    if (fileExtension === 'pdf') {
      return renderPDF()
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension || '')) {
      return renderImage()
    } else {
      // For other file types, provide download link
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-gray-500 mb-4">
            <i className="fas fa-file-alt text-4xl"></i>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            {fileName || 'Document'}
          </p>
          <a
            href={signedUrl}
            download={fileName}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <i className="fas fa-download mr-2"></i>
            Download
          </a>
        </div>
      )
    }
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading document...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-2">
            <i className="fas fa-exclamation-triangle text-2xl"></i>
          </div>
          <p className="text-sm text-gray-600 mb-2">{error}</p>
          <button
            onClick={generateSignedUrl}
            className="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {renderDocument()}
      
      {/* URL expiry indicator */}
      {urlExpiry && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
          <i className="fas fa-clock mr-1"></i>
          {Math.max(0, Math.floor((urlExpiry.getTime() - new Date().getTime()) / 60000))}m
        </div>
      )}
    </div>
  )
}

export default SecureDocumentViewer 
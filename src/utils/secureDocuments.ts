import { supabase } from '@/lib/supabase'

/**
 * Secure document access configuration
 */
export const DOCUMENT_CONFIG = {
  // Signed URL expiry time in seconds (1 hour)
  SIGNED_URL_EXPIRY: 3600,
  // Document bucket name
  BUCKET_NAME: 'documents',
  // Allowed document types
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  // Maximum file size (5MB)
  MAX_FILE_SIZE: 5 * 1024 * 1024
} as const

/**
 * Document access levels
 */
export enum DocumentAccessLevel {
  OWNER = 'owner',
  TENANT = 'tenant',
  ADMIN = 'admin'
}

/**
 * Interface for document metadata
 */
export interface DocumentMetadata {
  filePath: string
  fileName: string
  fileType: string
  fileSize: number
  uploadedAt: string
  uploadedBy: string
  accessLevel: DocumentAccessLevel
}

/**
 * Interface for FICA document data
 */
export interface FicaDocumentData {
  id_number: string
  portfolio_size?: string
  monthly_income?: number | null
  employment_status?: string | null
  document_path: string // Store path instead of URL
  uploaded_at: string
}

/**
 * Generate a secure signed URL for document access
 * @param filePath - The file path in storage
 * @param expirySeconds - URL expiry time in seconds (default: 1 hour)
 * @returns Promise with signed URL or error
 */
export async function getSecureDocumentUrl(
  filePath: string, 
  expirySeconds: number = DOCUMENT_CONFIG.SIGNED_URL_EXPIRY
): Promise<{ url: string; error: null } | { url: null; error: string }> {
  try {
    // Validate file path
    if (!filePath || typeof filePath !== 'string') {
      return { url: null, error: 'Invalid file path' }
    }

    // Get current user for access control
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { url: null, error: 'Authentication required' }
    }

    // Create signed URL
    const { data, error } = await supabase.storage
      .from(DOCUMENT_CONFIG.BUCKET_NAME)
      .createSignedUrl(filePath, expirySeconds)

    if (error) {
      console.error('Error creating signed URL:', error)
      return { url: null, error: 'Failed to generate secure URL' }
    }

    if (!data?.signedUrl) {
      return { url: null, error: 'No signed URL generated' }
    }

    return { url: data.signedUrl, error: null }
  } catch (error) {
    console.error('Error in getSecureDocumentUrl:', error)
    return { url: null, error: 'Internal server error' }
  }
}

/**
 * Upload a document securely and return the file path
 * @param file - The file to upload
 * @param userId - The user ID uploading the file
 * @param documentType - Type of document (e.g., 'fica', 'id')
 * @returns Promise with file path or error
 */
export async function uploadSecureDocument(
  file: File,
  userId: string,
  documentType: string
): Promise<{ filePath: string; error: null } | { filePath: null; error: string }> {
  try {
    // Validate file
    if (!file || !(file instanceof File)) {
      return { filePath: null, error: 'Invalid file' }
    }

    // Check file type
    if (!DOCUMENT_CONFIG.ALLOWED_TYPES.includes(file.type)) {
      return { filePath: null, error: 'File type not allowed' }
    }

    // Check file size
    if (file.size > DOCUMENT_CONFIG.MAX_FILE_SIZE) {
      return { filePath: null, error: 'File too large' }
    }

    // Generate secure file path
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop()
    const fileName = `${documentType}-${timestamp}.${fileExtension}`
    const filePath = `${documentType}-documents/${userId}/${fileName}`

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from(DOCUMENT_CONFIG.BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('File upload error:', uploadError)
      return { filePath: null, error: 'Failed to upload file' }
    }

    return { filePath, error: null }
  } catch (error) {
    console.error('Error in uploadSecureDocument:', error)
    return { filePath: null, error: 'Internal server error' }
  }
}

/**
 * Delete a document securely
 * @param filePath - The file path to delete
 * @param userId - The user ID requesting deletion
 * @returns Promise with success status
 */
export async function deleteSecureDocument(
  filePath: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Validate file path
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: 'Invalid file path' }
    }

    // Check if user has permission to delete this file
    if (!filePath.includes(`/${userId}/`)) {
      return { success: false, error: 'Access denied' }
    }

    // Delete file
    const { error } = await supabase.storage
      .from(DOCUMENT_CONFIG.BUCKET_NAME)
      .remove([filePath])

    if (error) {
      console.error('File deletion error:', error)
      return { success: false, error: 'Failed to delete file' }
    }

    return { success: true, error: null }
  } catch (error) {
    console.error('Error in deleteSecureDocument:', error)
    return { success: false, error: 'Internal server error' }
  }
}

/**
 * Get document metadata without exposing the file
 * @param filePath - The file path
 * @returns Promise with metadata or error
 */
export async function getDocumentMetadata(
  filePath: string
): Promise<{ metadata: DocumentMetadata | null; error: string | null }> {
  try {
    // Get file info from storage
    const { data, error } = await supabase.storage
      .from(DOCUMENT_CONFIG.BUCKET_NAME)
      .list(filePath.split('/').slice(0, -1).join('/'))

    if (error) {
      console.error('Error getting file metadata:', error)
      return { metadata: null, error: 'Failed to get file metadata' }
    }

    const fileName = filePath.split('/').pop()
    const fileInfo = data?.find(file => file.name === fileName)

    if (!fileInfo) {
      return { metadata: null, error: 'File not found' }
    }

    const metadata: DocumentMetadata = {
      filePath,
      fileName: fileInfo.name,
      fileType: fileInfo.metadata?.mimetype || 'unknown',
      fileSize: fileInfo.metadata?.size || 0,
      uploadedAt: fileInfo.updated_at || new Date().toISOString(),
      uploadedBy: filePath.split('/')[1] || 'unknown', // Extract user ID from path
      accessLevel: DocumentAccessLevel.TENANT // Default, should be determined by context
    }

    return { metadata, error: null }
  } catch (error) {
    console.error('Error in getDocumentMetadata:', error)
    return { metadata: null, error: 'Internal server error' }
  }
}

/**
 * Validate document access permissions
 * @param filePath - The file path
 * @param userId - The user ID requesting access
 * @param userRole - The user's role
 * @returns Boolean indicating if access is allowed
 */
export function validateDocumentAccess(
  filePath: string,
  userId: string,
  userRole: string
): boolean {
  try {
    // Extract user ID from file path
    const pathParts = filePath.split('/')
    const fileOwnerId = pathParts[1] // documents/userId/filename

    // Admin can access all documents
    if (userRole === 'admin') {
      return true
    }

    // Users can access their own documents
    if (fileOwnerId === userId) {
      return true
    }

    // Additional role-based access controls can be added here
    // For example, property owners might need access to tenant documents

    return false
  } catch (error) {
    console.error('Error in validateDocumentAccess:', error)
    return false
  }
} 
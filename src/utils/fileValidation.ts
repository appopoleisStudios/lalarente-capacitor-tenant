// File validation utilities for security
export interface FileValidationConfig {
  maxSizeMB: number
  allowedTypes: string[]
  allowedExtensions: string[]
  maxFileNameLength?: number
}

export interface FileValidationResult {
  isValid: boolean
  error?: string
}

// Default validation configurations
export const DEFAULT_IMAGE_CONFIG: FileValidationConfig = {
  maxSizeMB: 5,
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  maxFileNameLength: 100
}

export const DEFAULT_DOCUMENT_CONFIG: FileValidationConfig = {
  maxSizeMB: 10,
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
  maxFileNameLength: 100
}

export const DEFAULT_ID_DOCUMENT_CONFIG: FileValidationConfig = {
  maxSizeMB: 5,
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
  maxFileNameLength: 100
}

/**
 * Validates a file against security requirements
 */
export function validateFile(file: File, config: FileValidationConfig): FileValidationResult {
  // Check if file exists
  if (!file) {
    return { isValid: false, error: 'No file provided' }
  }

  // Validate file size
  const maxSizeBytes = config.maxSizeMB * 1024 * 1024
  if (file.size > maxSizeBytes) {
    return { 
      isValid: false, 
      error: `File size must be less than ${config.maxSizeMB}MB` 
    }
  }

  // Validate file type (MIME type)
  if (!config.allowedTypes.includes(file.type)) {
    return { 
      isValid: false, 
      error: `File type not allowed. Allowed types: ${config.allowedTypes.join(', ')}` 
    }
  }

  // Validate file extension
  const fileName = file.name.toLowerCase()
  const hasValidExtension = config.allowedExtensions.some(ext => 
    fileName.endsWith(ext.toLowerCase())
  )
  
  if (!hasValidExtension) {
    return { 
      isValid: false, 
      error: `File extension not allowed. Allowed extensions: ${config.allowedExtensions.join(', ')}` 
    }
  }

  // Validate filename length
  if (config.maxFileNameLength && file.name.length > config.maxFileNameLength) {
    return { 
      isValid: false, 
      error: `Filename too long. Maximum length: ${config.maxFileNameLength} characters` 
    }
  }

  // Additional security checks
  const securityCheck = performSecurityChecks(file)
  if (!securityCheck.isValid) {
    return securityCheck
  }

  return { isValid: true }
}

/**
 * Performs additional security checks on the file
 */
function performSecurityChecks(file: File): FileValidationResult {
  // Check for potentially dangerous file names
  const dangerousPatterns = [
    /\.\./, // Directory traversal
    /[<>:"|?*]/, // Invalid characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Reserved names (Windows)
    /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|msi|dll|sys)$/i // Executable files
  ]

  const fileName = file.name
  for (const pattern of dangerousPatterns) {
    if (pattern.test(fileName)) {
      return { 
        isValid: false, 
        error: 'File name contains invalid characters or is not allowed' 
      }
    }
  }

  // Check for empty files
  if (file.size === 0) {
    return { isValid: false, error: 'File cannot be empty' }
  }

  // Check for extremely large files (additional safety check)
  const maxSafeSize = 50 * 1024 * 1024 // 50MB absolute maximum
  if (file.size > maxSafeSize) {
    return { isValid: false, error: 'File size exceeds maximum allowed limit' }
  }

  return { isValid: true }
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Gets file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2)
}

/**
 * Validates image file specifically
 */
export function validateImageFile(file: File): FileValidationResult {
  return validateFile(file, DEFAULT_IMAGE_CONFIG)
}

/**
 * Validates document file specifically
 */
export function validateDocumentFile(file: File): FileValidationResult {
  return validateFile(file, DEFAULT_DOCUMENT_CONFIG)
}

/**
 * Validates ID document file specifically
 */
export function validateIdDocumentFile(file: File): FileValidationResult {
  return validateFile(file, DEFAULT_ID_DOCUMENT_CONFIG)
} 
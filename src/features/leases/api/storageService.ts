import { supabase } from '../../../lib/supabase';
import { decode } from 'base64-arraybuffer';

// Custom error types for better error handling
export class StorageUploadError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: any
  ) {
    super(message);
    this.name = 'StorageUploadError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public readonly originalError?: any) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Retry configuration for upload operations
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if error is retryable (network issues, timeouts, etc.)
 */
function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  const retryableMessages = [
    'network',
    'timeout',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'fetch failed',
    'Failed to fetch',
  ];
  
  const errorMessage = error.message?.toLowerCase() || '';
  return retryableMessages.some(msg => errorMessage.includes(msg.toLowerCase()));
}

/**
 * Validate base64 signature data
 */
function validateSignatureData(base64Signature: string): void {
  if (!base64Signature || base64Signature.trim().length === 0) {
    throw new ValidationError('Signature data is empty');
  }

  // Remove data URL prefix if present
  const base64Data = base64Signature.replace(/^data:image\/\w+;base64,/, '');
  
  // Check if it's valid base64
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(base64Data)) {
    throw new ValidationError('Invalid base64 signature data');
  }

  // Check minimum size (empty signatures are usually very small)
  if (base64Data.length < 100) {
    throw new ValidationError('Signature data is too small - please draw your signature');
  }
}

/**
 * Upload signature image to Supabase Storage with retry logic
 * @param leaseId - The lease ID
 * @param party - 'owner' or 'tenant'
 * @param base64Signature - Base64 encoded PNG image (with or without data:image/png;base64, prefix)
 * @returns Public URL of the uploaded signature
 * @throws {ValidationError} If signature data is invalid
 * @throws {NetworkError} If network connection fails
 * @throws {StorageUploadError} If storage upload fails after retries
 */
export async function uploadSignature(
  leaseId: string,
  party: 'owner' | 'tenant',
  base64Signature: string
): Promise<string> {
  // Validate inputs
  if (!leaseId || leaseId.trim().length === 0) {
    throw new ValidationError('Lease ID is required');
  }

  if (!party || !['owner', 'tenant'].includes(party)) {
    throw new ValidationError('Party must be either "owner" or "tenant"');
  }

  // Validate signature data
  validateSignatureData(base64Signature);

  let lastError: any;
  let delay = RETRY_CONFIG.initialDelayMs;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // Remove data URL prefix if present
      const base64Data = base64Signature.replace(/^data:image\/\w+;base64,/, '');
      
      // Convert base64 to array buffer
      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = decode(base64Data);
      } catch (decodeError) {
        throw new ValidationError('Failed to decode signature data - invalid base64 format');
      }

      // Validate array buffer size
      if (arrayBuffer.byteLength === 0) {
        throw new ValidationError('Decoded signature data is empty');
      }

      // Create file path
      const filePath = `${leaseId}/${party}.png`;
      
      // Upload to Supabase Storage (using existing 'signatures' bucket)
      const { data, error} = await supabase.storage
        .from('signatures')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/png',
          upsert: true, // Overwrite if exists
        });

      if (error) {
        // Check for specific error types
        if (error.message?.includes('Bucket not found')) {
          throw new StorageUploadError(
            'Storage bucket not configured. Please contact support.',
            'BUCKET_NOT_FOUND',
            error
          );
        }

        if (error.message?.includes('not allowed') || error.message?.includes('permission')) {
          throw new StorageUploadError(
            'You do not have permission to upload signatures. Please contact support.',
            'PERMISSION_DENIED',
            error
          );
        }

        if (error.message?.includes('size') || error.message?.includes('too large')) {
          throw new StorageUploadError(
            'Signature file is too large. Please try again.',
            'FILE_TOO_LARGE',
            error
          );
        }

        // Check if error is retryable
        if (isRetryableError(error) && attempt < RETRY_CONFIG.maxRetries) {
          console.warn(`Upload attempt ${attempt + 1} failed, retrying...`, error);
          lastError = error;
          await sleep(delay);
          delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
          continue;
        }

        throw new StorageUploadError(
          `Failed to upload signature: ${error.message}`,
          'UPLOAD_FAILED',
          error
        );
      }

      // Get public URL (using existing 'signatures' bucket)
      const { data: urlData } = supabase.storage
        .from('signatures')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new StorageUploadError(
          'Failed to generate public URL for signature',
          'URL_GENERATION_FAILED'
        );
      }

      // Success - return the URL
      console.log(`Signature uploaded successfully on attempt ${attempt + 1}`);
      return urlData.publicUrl;

    } catch (error) {
      // Don't retry validation errors or non-retryable storage errors
      if (
        error instanceof ValidationError ||
        (error instanceof StorageUploadError && !isRetryableError(error.originalError))
      ) {
        throw error;
      }

      // Check for network errors
      if (isRetryableError(error)) {
        if (attempt < RETRY_CONFIG.maxRetries) {
          console.warn(`Upload attempt ${attempt + 1} failed with network error, retrying...`, error);
          lastError = error;
          await sleep(delay);
          delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
          continue;
        }
        throw new NetworkError(
          'Network connection failed. Please check your internet connection and try again.',
          error
        );
      }

      // Unknown error
      console.error('Unexpected error uploading signature:', error);
      throw new StorageUploadError(
        'An unexpected error occurred while uploading signature. Please try again.',
        'UNKNOWN_ERROR',
        error
      );
    }
  }

  // If we exhausted all retries
  throw new NetworkError(
    'Failed to upload signature after multiple attempts. Please check your connection and try again.',
    lastError
  );
}

/**
 * Upload lease PDF document to Supabase Storage with retry logic
 * @param leaseId - The lease ID
 * @param pdfData - PDF file data
 * @returns Public URL of the uploaded PDF
 * @throws {ValidationError} If PDF data is invalid
 * @throws {NetworkError} If network connection fails
 * @throws {StorageUploadError} If storage upload fails after retries
 */
export async function uploadLeasePDF(
  leaseId: string,
  pdfData: Blob | ArrayBuffer
): Promise<string> {
  // Validate inputs
  if (!leaseId || leaseId.trim().length === 0) {
    throw new ValidationError('Lease ID is required');
  }

  if (!pdfData) {
    throw new ValidationError('PDF data is required');
  }

  // Validate PDF size
  const size = pdfData instanceof Blob ? pdfData.size : pdfData.byteLength;
  if (size === 0) {
    throw new ValidationError('PDF data is empty');
  }

  // Check max size (10MB)
  const maxSize = 10 * 1024 * 1024;
  if (size > maxSize) {
    throw new ValidationError('PDF file is too large (max 10MB)');
  }

  let lastError: any;
  let delay = RETRY_CONFIG.initialDelayMs;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const filePath = `${leaseId}/signed-lease.pdf`;
      
      const { data, error } = await supabase.storage
        .from('contracts')
        .upload(filePath, pdfData, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (error) {
        // Check for specific error types
        if (error.message?.includes('Bucket not found')) {
          throw new StorageUploadError(
            'Storage bucket not configured. Please contact support.',
            'BUCKET_NOT_FOUND',
            error
          );
        }

        if (error.message?.includes('not allowed') || error.message?.includes('permission')) {
          throw new StorageUploadError(
            'You do not have permission to upload documents. Please contact support.',
            'PERMISSION_DENIED',
            error
          );
        }

        if (error.message?.includes('size') || error.message?.includes('too large')) {
          throw new StorageUploadError(
            'PDF file is too large. Please try again with a smaller file.',
            'FILE_TOO_LARGE',
            error
          );
        }

        // Check if error is retryable
        if (isRetryableError(error) && attempt < RETRY_CONFIG.maxRetries) {
          console.warn(`PDF upload attempt ${attempt + 1} failed, retrying...`, error);
          lastError = error;
          await sleep(delay);
          delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
          continue;
        }

        throw new StorageUploadError(
          `Failed to upload PDF: ${error.message}`,
          'UPLOAD_FAILED',
          error
        );
      }

      const { data: urlData } = supabase.storage
        .from('contracts')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new StorageUploadError(
          'Failed to generate public URL for PDF',
          'URL_GENERATION_FAILED'
        );
      }

      console.log(`PDF uploaded successfully on attempt ${attempt + 1}`);
      return urlData.publicUrl;

    } catch (error) {
      // Don't retry validation errors or non-retryable storage errors
      if (
        error instanceof ValidationError ||
        (error instanceof StorageUploadError && !isRetryableError(error.originalError))
      ) {
        throw error;
      }

      // Check for network errors
      if (isRetryableError(error)) {
        if (attempt < RETRY_CONFIG.maxRetries) {
          console.warn(`PDF upload attempt ${attempt + 1} failed with network error, retrying...`, error);
          lastError = error;
          await sleep(delay);
          delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
          continue;
        }
        throw new NetworkError(
          'Network connection failed. Please check your internet connection and try again.',
          error
        );
      }

      console.error('Unexpected error uploading PDF:', error);
      throw new StorageUploadError(
        'An unexpected error occurred while uploading PDF. Please try again.',
        'UNKNOWN_ERROR',
        error
      );
    }
  }

  // If we exhausted all retries
  throw new NetworkError(
    'Failed to upload PDF after multiple attempts. Please check your connection and try again.',
    lastError
  );
}

/**
 * Delete signature from storage with retry logic
 * @param leaseId - The lease ID
 * @param party - 'owner' or 'tenant'
 * @throws {ValidationError} If inputs are invalid
 * @throws {NetworkError} If network connection fails
 * @throws {StorageUploadError} If storage deletion fails after retries
 */
export async function deleteSignature(
  leaseId: string,
  party: 'owner' | 'tenant'
): Promise<void> {
  // Validate inputs
  if (!leaseId || leaseId.trim().length === 0) {
    throw new ValidationError('Lease ID is required');
  }

  if (!party || !['owner', 'tenant'].includes(party)) {
    throw new ValidationError('Party must be either "owner" or "tenant"');
  }

  let lastError: any;
  let delay = RETRY_CONFIG.initialDelayMs;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const filePath = `${leaseId}/${party}.png`;
      
      const { error } = await supabase.storage
        .from('signatures')
        .remove([filePath]);

      if (error) {
        // Check for specific error types
        if (error.message?.includes('Bucket not found')) {
          throw new StorageUploadError(
            'Storage bucket not configured. Please contact support.',
            'BUCKET_NOT_FOUND',
            error
          );
        }

        if (error.message?.includes('not allowed') || error.message?.includes('permission')) {
          throw new StorageUploadError(
            'You do not have permission to delete signatures. Please contact support.',
            'PERMISSION_DENIED',
            error
          );
        }

        // File not found is not an error - it's already deleted
        if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
          console.log('Signature already deleted or does not exist');
          return;
        }

        // Check if error is retryable
        if (isRetryableError(error) && attempt < RETRY_CONFIG.maxRetries) {
          console.warn(`Delete attempt ${attempt + 1} failed, retrying...`, error);
          lastError = error;
          await sleep(delay);
          delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
          continue;
        }

        throw new StorageUploadError(
          `Failed to delete signature: ${error.message}`,
          'DELETE_FAILED',
          error
        );
      }

      console.log(`Signature deleted successfully on attempt ${attempt + 1}`);
      return;

    } catch (error) {
      // Don't retry validation errors or non-retryable storage errors
      if (
        error instanceof ValidationError ||
        (error instanceof StorageUploadError && !isRetryableError(error.originalError))
      ) {
        throw error;
      }

      // Check for network errors
      if (isRetryableError(error)) {
        if (attempt < RETRY_CONFIG.maxRetries) {
          console.warn(`Delete attempt ${attempt + 1} failed with network error, retrying...`, error);
          lastError = error;
          await sleep(delay);
          delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
          continue;
        }
        throw new NetworkError(
          'Network connection failed. Please check your internet connection and try again.',
          error
        );
      }

      console.error('Unexpected error deleting signature:', error);
      throw new StorageUploadError(
        'An unexpected error occurred while deleting signature. Please try again.',
        'UNKNOWN_ERROR',
        error
      );
    }
  }

  // If we exhausted all retries
  throw new NetworkError(
    'Failed to delete signature after multiple attempts. Please check your connection and try again.',
    lastError
  );
}

/**
 * Check if storage bucket exists and is accessible
 * @param bucketName - Name of the bucket to check
 * @returns true if bucket exists and is accessible
 */
export async function checkBucketExists(bucketName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.getBucket(bucketName);
    return !error && !!data;
  } catch (error) {
    console.error(`Error checking bucket ${bucketName}:`, error);
    return false;
  }
}

/**
 * Get user-friendly error message from storage error
 * @param error - The error object
 * @returns User-friendly error message
 */
export function getStorageErrorMessage(error: any): string {
  if (error instanceof ValidationError) {
    return error.message;
  }

  if (error instanceof NetworkError) {
    return 'Network connection failed. Please check your internet connection and try again.';
  }

  if (error instanceof StorageUploadError) {
    switch (error.code) {
      case 'BUCKET_NOT_FOUND':
        return 'Storage is not properly configured. Please contact support.';
      case 'PERMISSION_DENIED':
        return 'You do not have permission to perform this action. Please contact support.';
      case 'FILE_TOO_LARGE':
        return 'File is too large. Please try with a smaller file.';
      case 'URL_GENERATION_FAILED':
        return 'Failed to generate file URL. Please try again.';
      default:
        return error.message || 'Failed to upload file. Please try again.';
    }
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Example usage of storage service with comprehensive error handling
 * 
 * This file demonstrates best practices for handling storage upload errors
 * in the lease signature workflow.
 */

import { Alert } from 'react-native';
import {
  uploadSignature,
  uploadLeasePDF,
  deleteSignature,
  checkBucketExists,
  getStorageErrorMessage,
  ValidationError,
  NetworkError,
  StorageUploadError,
} from './storageService';

/**
 * Example 1: Basic signature upload with error handling
 */
export async function exampleBasicUpload(
  leaseId: string,
  party: 'owner' | 'tenant',
  signatureBase64: string
): Promise<string | null> {
  try {
    const url = await uploadSignature(leaseId, party, signatureBase64);
    console.log('✅ Signature uploaded successfully:', url);
    return url;
  } catch (error) {
    console.error('❌ Upload failed:', error);

    if (error instanceof ValidationError) {
      // Input validation failed - show specific error
      Alert.alert('Invalid Input', error.message);
    } else if (error instanceof NetworkError) {
      // Network issue - suggest checking connection
      Alert.alert(
        'Connection Error',
        'Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    } else if (error instanceof StorageUploadError) {
      // Storage-specific error - handle based on code
      switch (error.code) {
        case 'BUCKET_NOT_FOUND':
          Alert.alert(
            'Configuration Error',
            'Storage is not properly configured. Please contact support.',
            [{ text: 'Contact Support' }]
          );
          break;
        case 'PERMISSION_DENIED':
          Alert.alert(
            'Permission Error',
            'You do not have permission to upload signatures. Please contact support.',
            [{ text: 'Contact Support' }]
          );
          break;
        case 'FILE_TOO_LARGE':
          Alert.alert(
            'File Too Large',
            'Signature file is too large. Please try again.',
            [{ text: 'Try Again' }]
          );
          break;
        default:
          Alert.alert('Upload Error', error.message);
      }
    } else {
      // Unknown error - use helper function
      Alert.alert('Error', getStorageErrorMessage(error));
    }

    return null;
  }
}

/**
 * Example 2: Upload with loading state and retry option
 */
export async function exampleUploadWithRetry(
  leaseId: string,
  party: 'owner' | 'tenant',
  signatureBase64: string,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
): Promise<string | null> {
  setLoading(true);
  setError(null);

  try {
    const url = await uploadSignature(leaseId, party, signatureBase64);
    Alert.alert('Success', 'Signature saved successfully!');
    return url;
  } catch (error) {
    const errorMessage = getStorageErrorMessage(error);
    setError(errorMessage);

    // For network errors, offer retry option
    if (error instanceof NetworkError) {
      Alert.alert(
        'Connection Error',
        errorMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Retry',
            onPress: () => exampleUploadWithRetry(leaseId, party, signatureBase64, setLoading, setError),
          },
        ]
      );
    } else {
      Alert.alert('Upload Failed', errorMessage);
    }

    return null;
  } finally {
    setLoading(false);
  }
}

/**
 * Example 3: Pre-flight check before upload
 */
export async function exampleUploadWithPreCheck(
  leaseId: string,
  party: 'owner' | 'tenant',
  signatureBase64: string
): Promise<string | null> {
  // Check if bucket exists before attempting upload
  const bucketExists = await checkBucketExists('lease-signatures');

  if (!bucketExists) {
    Alert.alert(
      'Configuration Error',
      'Storage is not properly configured. Please contact support.',
      [{ text: 'Contact Support' }]
    );
    return null;
  }

  // Validate signature data before upload
  if (!signatureBase64 || signatureBase64.trim().length === 0) {
    Alert.alert('Empty Signature', 'Please draw your signature before saving.');
    return null;
  }

  // Proceed with upload
  try {
    const url = await uploadSignature(leaseId, party, signatureBase64);
    return url;
  } catch (error) {
    Alert.alert('Upload Failed', getStorageErrorMessage(error));
    return null;
  }
}

/**
 * Example 4: Complete signature flow with database update
 */
export async function exampleCompleteSignatureFlow(
  leaseId: string,
  party: 'owner' | 'tenant',
  signatureBase64: string,
  updateLeaseInDatabase: (leaseId: string, updates: any) => Promise<void>
): Promise<boolean> {
  try {
    // Step 1: Upload signature to storage
    console.log('📤 Uploading signature...');
    const signatureUrl = await uploadSignature(leaseId, party, signatureBase64);
    console.log('✅ Signature uploaded:', signatureUrl);

    // Step 2: Update lease record in database
    console.log('💾 Updating lease record...');
    const updates = {
      [`${party}_signature_url`]: signatureUrl,
      [`${party}_signed_at`]: new Date().toISOString(),
    };
    await updateLeaseInDatabase(leaseId, updates);
    console.log('✅ Lease record updated');

    // Step 3: Show success message
    Alert.alert(
      'Success',
      'Your signature has been saved successfully!',
      [{ text: 'OK' }]
    );

    return true;
  } catch (error) {
    console.error('❌ Signature flow failed:', error);

    // Rollback: Try to delete uploaded signature if database update failed
    if (error instanceof Error && error.message.includes('database')) {
      console.log('🔄 Rolling back signature upload...');
      try {
        await deleteSignature(leaseId, party);
        console.log('✅ Rollback successful');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
    }

    // Show error to user
    Alert.alert('Signature Failed', getStorageErrorMessage(error));
    return false;
  }
}

/**
 * Example 5: PDF upload with progress tracking
 */
export async function examplePDFUpload(
  leaseId: string,
  pdfData: Blob,
  onProgress?: (progress: number) => void
): Promise<string | null> {
  try {
    // Show initial progress
    onProgress?.(0);

    // Validate PDF size before upload
    if (pdfData.size > 10 * 1024 * 1024) {
      throw new ValidationError('PDF file is too large (max 10MB)');
    }

    onProgress?.(25);

    // Upload PDF
    const url = await uploadLeasePDF(leaseId, pdfData);

    onProgress?.(100);
    console.log('✅ PDF uploaded:', url);

    return url;
  } catch (error) {
    onProgress?.(0);
    console.error('❌ PDF upload failed:', error);

    if (error instanceof ValidationError) {
      Alert.alert('Invalid PDF', error.message);
    } else if (error instanceof NetworkError) {
      Alert.alert(
        'Connection Error',
        'Failed to upload PDF. Please check your connection and try again.'
      );
    } else {
      Alert.alert('Upload Failed', getStorageErrorMessage(error));
    }

    return null;
  }
}

/**
 * Example 6: Batch operations with error handling
 */
export async function exampleBatchUpload(
  leaseId: string,
  ownerSignature: string,
  tenantSignature: string
): Promise<{ ownerUrl: string | null; tenantUrl: string | null }> {
  const results = {
    ownerUrl: null as string | null,
    tenantUrl: null as string | null,
  };

  // Upload owner signature
  try {
    results.ownerUrl = await uploadSignature(leaseId, 'owner', ownerSignature);
    console.log('✅ Owner signature uploaded');
  } catch (error) {
    console.error('❌ Owner signature upload failed:', error);
    Alert.alert('Owner Signature Failed', getStorageErrorMessage(error));
  }

  // Upload tenant signature (continue even if owner failed)
  try {
    results.tenantUrl = await uploadSignature(leaseId, 'tenant', tenantSignature);
    console.log('✅ Tenant signature uploaded');
  } catch (error) {
    console.error('❌ Tenant signature upload failed:', error);
    Alert.alert('Tenant Signature Failed', getStorageErrorMessage(error));
  }

  // Check if both succeeded
  if (results.ownerUrl && results.tenantUrl) {
    Alert.alert('Success', 'Both signatures uploaded successfully!');
  } else if (results.ownerUrl || results.tenantUrl) {
    Alert.alert('Partial Success', 'One signature uploaded. Please retry the failed upload.');
  } else {
    Alert.alert('Upload Failed', 'Both signatures failed to upload. Please try again.');
  }

  return results;
}

/**
 * Example 7: Error recovery with fallback
 */
export async function exampleUploadWithFallback(
  leaseId: string,
  party: 'owner' | 'tenant',
  signatureBase64: string,
  fallbackHandler: (signature: string) => Promise<void>
): Promise<string | null> {
  try {
    // Try primary upload method
    return await uploadSignature(leaseId, party, signatureBase64);
  } catch (error) {
    console.error('Primary upload failed:', error);

    // If it's a storage configuration error, use fallback
    if (error instanceof StorageUploadError && error.code === 'BUCKET_NOT_FOUND') {
      console.log('Using fallback handler...');
      try {
        await fallbackHandler(signatureBase64);
        Alert.alert(
          'Signature Saved',
          'Signature saved using alternative method. It will be uploaded when storage is available.'
        );
        return 'pending-upload';
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        Alert.alert('Save Failed', 'Unable to save signature. Please contact support.');
        return null;
      }
    }

    // For other errors, just show the error
    Alert.alert('Upload Failed', getStorageErrorMessage(error));
    return null;
  }
}

/**
 * Example 8: Testing error scenarios (for development)
 */
export async function exampleTestErrorScenarios() {
  console.log('🧪 Testing error scenarios...');

  // Test 1: Empty signature
  try {
    await uploadSignature('test-lease', 'owner', '');
  } catch (error) {
    console.log('✅ Test 1 passed: Empty signature caught', error instanceof ValidationError);
  }

  // Test 2: Invalid party
  try {
    await uploadSignature('test-lease', 'invalid' as any, 'data:image/png;base64,abc123');
  } catch (error) {
    console.log('✅ Test 2 passed: Invalid party caught', error instanceof ValidationError);
  }

  // Test 3: Invalid base64
  try {
    await uploadSignature('test-lease', 'owner', 'not-base64-data!!!');
  } catch (error) {
    console.log('✅ Test 3 passed: Invalid base64 caught', error instanceof ValidationError);
  }

  // Test 4: Empty lease ID
  try {
    await uploadSignature('', 'owner', 'data:image/png;base64,abc123');
  } catch (error) {
    console.log('✅ Test 4 passed: Empty lease ID caught', error instanceof ValidationError);
  }

  console.log('🧪 Error scenario tests complete');
}

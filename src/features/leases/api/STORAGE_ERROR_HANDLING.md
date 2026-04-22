# Storage Service Error Handling

## Overview

The storage service now includes comprehensive error handling for signature and document uploads with automatic retry logic for transient failures.

## Error Types

### 1. ValidationError
Thrown when input data is invalid:
- Empty or missing lease ID
- Invalid party type (must be 'owner' or 'tenant')
- Empty signature data
- Invalid base64 format
- Signature too small (likely empty drawing)
- PDF data empty or too large (>10MB)

**User Action**: Fix the input and try again. No retry needed.

### 2. NetworkError
Thrown when network connectivity issues occur:
- Connection timeout
- DNS resolution failure
- Network unreachable
- Fetch failed

**User Action**: Check internet connection and try again. Automatic retry is attempted.

### 3. StorageUploadError
Thrown when storage operations fail:
- `BUCKET_NOT_FOUND`: Storage bucket not configured
- `PERMISSION_DENIED`: User lacks upload permissions
- `FILE_TOO_LARGE`: File exceeds size limits
- `URL_GENERATION_FAILED`: Failed to generate public URL
- `UPLOAD_FAILED`: Generic upload failure
- `DELETE_FAILED`: Failed to delete file
- `UNKNOWN_ERROR`: Unexpected error

**User Action**: Depends on error code. Some require support contact, others can be retried.

## Retry Logic

### Configuration
```typescript
const RETRY_CONFIG = {
  maxRetries: 3,           // Maximum number of retry attempts
  initialDelayMs: 1000,    // Initial delay before first retry (1 second)
  maxDelayMs: 5000,        // Maximum delay between retries (5 seconds)
  backoffMultiplier: 2,    // Exponential backoff multiplier
};
```

### Retry Strategy
1. **Attempt 1**: Immediate upload
2. **Attempt 2**: Wait 1 second, retry
3. **Attempt 3**: Wait 2 seconds, retry
4. **Attempt 4**: Wait 4 seconds, retry
5. **Failure**: Throw NetworkError or StorageUploadError

### Retryable Errors
Only network-related errors are retried:
- Network timeouts
- Connection refused
- DNS failures
- Fetch failures

### Non-Retryable Errors
These fail immediately without retry:
- Validation errors (bad input)
- Permission errors (access denied)
- Bucket not found (configuration issue)
- File too large (size limit)

## Functions

### uploadSignature(leaseId, party, base64Signature)
Uploads a signature image with validation and retry logic.

**Validations**:
- Lease ID is required and non-empty
- Party must be 'owner' or 'tenant'
- Signature data must be valid base64
- Signature must be at least 100 characters (prevents empty signatures)
- Decoded data must not be empty

**Returns**: Public URL of uploaded signature

**Throws**: ValidationError, NetworkError, or StorageUploadError

### uploadLeasePDF(leaseId, pdfData)
Uploads a lease PDF document with validation and retry logic.

**Validations**:
- Lease ID is required and non-empty
- PDF data is required
- PDF size must be > 0 bytes
- PDF size must be < 10MB

**Returns**: Public URL of uploaded PDF

**Throws**: ValidationError, NetworkError, or StorageUploadError

### deleteSignature(leaseId, party)
Deletes a signature from storage with retry logic.

**Validations**:
- Lease ID is required and non-empty
- Party must be 'owner' or 'tenant'

**Note**: If file doesn't exist, returns successfully (idempotent)

**Throws**: ValidationError, NetworkError, or StorageUploadError

### checkBucketExists(bucketName)
Checks if a storage bucket exists and is accessible.

**Returns**: boolean (true if bucket exists)

### getStorageErrorMessage(error)
Converts error objects to user-friendly messages.

**Returns**: string with user-friendly error message

## Usage Examples

### Basic Upload with Error Handling

```typescript
import { 
  uploadSignature, 
  ValidationError, 
  NetworkError, 
  StorageUploadError,
  getStorageErrorMessage 
} from './storageService';

try {
  const url = await uploadSignature(leaseId, 'tenant', signatureBase64);
  console.log('Signature uploaded:', url);
} catch (error) {
  if (error instanceof ValidationError) {
    // Show validation error to user
    Alert.alert('Invalid Input', error.message);
  } else if (error instanceof NetworkError) {
    // Show network error with retry option
    Alert.alert(
      'Connection Error',
      'Please check your internet connection and try again.'
    );
  } else if (error instanceof StorageUploadError) {
    // Show storage error based on code
    if (error.code === 'BUCKET_NOT_FOUND') {
      Alert.alert('Configuration Error', 'Please contact support.');
    } else {
      Alert.alert('Upload Failed', error.message);
    }
  } else {
    // Unknown error
    Alert.alert('Error', getStorageErrorMessage(error));
  }
}
```

### Upload with Loading State

```typescript
const [uploading, setUploading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleUpload = async (signature: string) => {
  setUploading(true);
  setError(null);
  
  try {
    const url = await uploadSignature(leaseId, 'owner', signature);
    // Update lease record with signature URL
    await updateLease(leaseId, { owner_signature_url: url });
    Alert.alert('Success', 'Signature saved successfully!');
  } catch (err) {
    const message = getStorageErrorMessage(err);
    setError(message);
    Alert.alert('Upload Failed', message);
  } finally {
    setUploading(false);
  }
};
```

### Check Bucket Before Upload

```typescript
import { checkBucketExists, uploadSignature } from './storageService';

const handleUpload = async (signature: string) => {
  // Check if bucket exists first
  const bucketExists = await checkBucketExists('lease-signatures');
  
  if (!bucketExists) {
    Alert.alert(
      'Configuration Error',
      'Storage is not properly configured. Please contact support.'
    );
    return;
  }
  
  // Proceed with upload
  try {
    const url = await uploadSignature(leaseId, 'tenant', signature);
    // ...
  } catch (error) {
    // Handle error
  }
};
```

## Integration with SignatureModal

The SignatureModal component automatically handles errors from the storage service:

```typescript
<SignatureModal
  visible={showModal}
  onClose={() => setShowModal(false)}
  onSave={async (signature) => {
    // This will automatically handle all error types
    const url = await uploadSignature(leaseId, 'tenant', signature);
    await updateLeaseSignature(leaseId, url);
  }}
  title="Sign Lease Agreement"
/>
```

The modal will display appropriate error messages based on the error type:
- **ValidationError**: "Invalid Signature - Please draw your signature and try again."
- **NetworkError**: "Connection Error - Please check your internet connection and try again."
- **StorageUploadError**: Specific message based on error code

## Testing Error Scenarios

### Test Network Failure
1. Turn off internet connection
2. Try to upload signature
3. Should see "Connection Error" after retry attempts
4. Turn on internet and retry - should succeed

### Test Invalid Signature
1. Try to save without drawing anything
2. Should see "Invalid Signature" immediately (no retry)

### Test Bucket Not Found
1. Use incorrect bucket name in storage service
2. Should see "Configuration Error" immediately (no retry)

### Test Large File
1. Try to upload PDF > 10MB
2. Should see "File too large" immediately (no retry)

## Monitoring and Logging

All errors are logged to console with context:
- Upload attempts and retry count
- Error type and message
- Original error object for debugging

Example logs:
```
Upload attempt 1 failed, retrying... [NetworkError]
Upload attempt 2 failed, retrying... [NetworkError]
Signature uploaded successfully on attempt 3
```

## Best Practices

1. **Always use try-catch** when calling storage functions
2. **Show loading states** during upload operations
3. **Provide clear error messages** to users
4. **Allow retry** for network errors
5. **Don't retry** validation or permission errors
6. **Log errors** for debugging and monitoring
7. **Test offline scenarios** during development
8. **Validate input** before calling storage functions

## Future Improvements

- [ ] Add progress tracking for large file uploads
- [ ] Implement upload cancellation
- [ ] Add file compression for signatures
- [ ] Implement background upload queue
- [ ] Add telemetry for error tracking
- [ ] Implement circuit breaker for repeated failures
- [ ] Add upload resume capability
- [ ] Implement client-side encryption

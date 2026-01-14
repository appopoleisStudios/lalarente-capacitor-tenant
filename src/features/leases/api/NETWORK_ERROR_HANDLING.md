# Network Error Handling During Lease Signing

## Overview

This document describes the comprehensive network error handling implemented for the lease signature workflow. The implementation ensures a robust signing experience even in poor network conditions.

## Architecture

The network error handling is implemented at **three levels**:

1. **Storage Layer** (`storageService.ts`) - Handles signature upload failures
2. **Database Layer** (Lease screens) - Handles database update failures
3. **Business Logic Layer** (Lease screens) - Handles lease execution failures

## 1. Storage Layer Error Handling

### Location
`src/features/leases/api/storageService.ts`

### Features
- **Automatic retry logic** with exponential backoff (3 retries)
- **Network error detection** via `isRetryableError()` function
- **Custom error types**:
  - `ValidationError` - Invalid input data
  - `NetworkError` - Network connection failures
  - `StorageUploadError` - Storage-specific errors with error codes

### Retry Configuration
```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};
```

### Retryable Errors
The following error patterns trigger automatic retry:
- `network`
- `timeout`
- `ECONNREFUSED`
- `ETIMEDOUT`
- `ENOTFOUND`
- `fetch failed`
- `Failed to fetch`

### Error Codes
- `BUCKET_NOT_FOUND` - Storage bucket not configured
- `PERMISSION_DENIED` - Insufficient permissions
- `FILE_TOO_LARGE` - File exceeds size limit
- `UPLOAD_FAILED` - Generic upload failure
- `URL_GENERATION_FAILED` - Failed to generate public URL
- `UNKNOWN_ERROR` - Unexpected error

### User-Friendly Messages
The `SignatureModal` component displays specific error messages based on error type:
- **ValidationError**: "Invalid Signature - Please draw your signature and try again."
- **NetworkError**: "Connection Error - Please check your internet connection and try again."
- **StorageUploadError**: Context-specific messages based on error code

## 2. Database Layer Error Handling

### Location
- `src/features/owner/screens/OwnerLeaseDetailScreen.tsx` - `handleSignatureSave()`
- `src/features/tenant/screens/TenantLeaseScreen.tsx` - `handleSignatureSave()`

### Features
- **Retry logic for database updates** (3 attempts)
- **Network error detection** in Supabase operations
- **Exponential backoff** between retries (1s, 2s, 3s)
- **User-friendly error messages**

### Implementation
```typescript
// Update lease with signature (with retry logic for network errors)
let updateSuccess = false;
let lastError: any;
const maxRetries = 3;

for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    const { error: updateError } = await supabase
      .from('leases')
      .update({
        owner_signature_url: signatureUrl,
        owner_signed_at: new Date().toISOString(),
        status: 'active',
        executed_at: new Date().toISOString(),
      })
      .eq('id', lease.id);

    if (updateError) {
      // Check if it's a network error
      const errorMessage = updateError.message?.toLowerCase() || '';
      const isNetworkError = 
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('connection');

      if (isNetworkError && attempt < maxRetries - 1) {
        console.warn(`Database update attempt ${attempt + 1} failed, retrying...`);
        lastError = updateError;
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      throw updateError;
    }

    updateSuccess = true;
    break;
  } catch (error) {
    lastError = error;
    if (attempt === maxRetries - 1) {
      throw error;
    }
  }
}
```

### Network Error Detection
Database operations are checked for network-related errors:
- `network`
- `timeout`
- `fetch failed`
- `connection`

## 3. Business Logic Layer Error Handling

### Location
- `src/features/owner/screens/OwnerLeaseDetailScreen.tsx` - Lease execution
- `src/features/tenant/screens/TenantLeaseScreen.tsx` - N/A (tenant doesn't execute)

### Features
- **Retry logic for lease execution** (3 attempts)
- **Graceful degradation** - Lease remains signed even if execution partially fails
- **Non-critical failure handling** - Alerts user but doesn't fail the entire operation

### Implementation
```typescript
// Execute lease (update property, create payment, notify) with retry logic
let executeSuccess = false;
for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    await executeLease(lease.id);
    executeSuccess = true;
    break;
  } catch (error: any) {
    const errorMessage = error?.message?.toLowerCase() || '';
    const isNetworkError = 
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('connection');

    if (isNetworkError && attempt < maxRetries - 1) {
      console.warn(`Lease execution attempt ${attempt + 1} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    
    // If lease execution fails, log but don't fail the whole operation
    // The lease is already signed and active
    console.error('Error executing lease (non-critical):', error);
    Alert.alert(
      'Partial Success',
      'Lease signed successfully, but some automated tasks may need manual completion. Please contact support if needed.',
      [{ text: 'OK', onPress: () => loadLease() }]
    );
    return;
  }
}
```

### Graceful Degradation
If lease execution fails after retries:
1. The lease signature is **already saved** and **status is active**
2. User is notified of **partial success**
3. Manual intervention may be needed for:
   - Property status update
   - First payment creation
   - Notification sending

## Error Flow Diagram

```
User Signs Lease
       ↓
┌──────────────────────────────────────┐
│ 1. Upload Signature to Storage       │
│    - Retry 3x with backoff           │
│    - Detect network errors           │
│    - Show specific error messages    │
└──────────────────────────────────────┘
       ↓ (Success)
┌──────────────────────────────────────┐
│ 2. Update Lease in Database          │
│    - Retry 3x with backoff           │
│    - Detect network errors           │
│    - Save signature URL & timestamp  │
└──────────────────────────────────────┘
       ↓ (Success)
┌──────────────────────────────────────┐
│ 3. Execute Lease (Owner only)        │
│    - Retry 3x with backoff           │
│    - Detect network errors           │
│    - Update property status          │
│    - Create first payment            │
│    - Send notifications              │
│    - GRACEFUL: Partial success OK    │
└──────────────────────────────────────┘
       ↓
   Success!
```

## User Experience

### Successful Signing
1. User draws signature
2. Taps "Confirm Signature"
3. Loading indicator shows
4. Success message: "Lease agreement signed and activated!" (Owner) or "Lease agreement signed! Waiting for owner to sign." (Tenant)

### Network Error During Upload
1. User draws signature
2. Taps "Confirm Signature"
3. Loading indicator shows
4. Automatic retry (3 attempts)
5. If all retries fail:
   - Error alert: "Connection Error - Please check your internet connection and try again."
   - Modal remains open
   - User can try again

### Network Error During Database Update
1. Signature uploaded successfully
2. Database update fails
3. Automatic retry (3 attempts)
4. If all retries fail:
   - Error alert: "Connection Error - Please check your internet connection and try again."
   - Modal closes
   - User can try signing again (signature will be overwritten)

### Network Error During Lease Execution (Owner only)
1. Signature uploaded successfully
2. Database updated successfully
3. Lease execution fails
4. Automatic retry (3 attempts)
5. If all retries fail:
   - Alert: "Partial Success - Lease signed successfully, but some automated tasks may need manual completion."
   - Lease is still signed and active
   - Manual intervention may be needed

## Testing Scenarios

### Manual Testing
1. **Airplane Mode Test**
   - Enable airplane mode
   - Try to sign lease
   - Should show connection error after retries
   - Disable airplane mode
   - Try again - should succeed

2. **Slow Network Test**
   - Use network throttling (Chrome DevTools)
   - Sign lease
   - Should retry and eventually succeed

3. **Intermittent Network Test**
   - Toggle airplane mode during signing
   - Should retry and recover

4. **Storage Bucket Missing Test**
   - Remove storage bucket
   - Try to sign
   - Should show "Storage is not properly configured"

### Automated Testing
```typescript
// Test retry logic
it('should retry on network error', async () => {
  // Mock network failure twice, then success
  mockSupabase.storage.from().upload
    .mockRejectedValueOnce(new Error('network error'))
    .mockRejectedValueOnce(new Error('network error'))
    .mockResolvedValueOnce({ data: { path: 'test.png' }, error: null });

  const result = await uploadSignature('lease-123', 'owner', 'base64data');
  expect(result).toBeDefined();
  expect(mockSupabase.storage.from().upload).toHaveBeenCalledTimes(3);
});

// Test graceful degradation
it('should succeed even if lease execution fails', async () => {
  mockExecuteLease.mockRejectedValue(new Error('network error'));
  
  await handleSignatureSave('base64data');
  
  // Lease should still be signed
  expect(mockSupabase.from('leases').update).toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith(
    'Partial Success',
    expect.stringContaining('Lease signed successfully')
  );
});
```

## Configuration

### Retry Settings
To adjust retry behavior, modify `RETRY_CONFIG` in `storageService.ts`:
```typescript
const RETRY_CONFIG = {
  maxRetries: 3,              // Number of retry attempts
  initialDelayMs: 1000,       // Initial delay (1 second)
  maxDelayMs: 5000,           // Maximum delay (5 seconds)
  backoffMultiplier: 2,       // Exponential backoff multiplier
};
```

### Network Error Patterns
To add more retryable error patterns, update `isRetryableError()`:
```typescript
const retryableMessages = [
  'network',
  'timeout',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'fetch failed',
  'Failed to fetch',
  // Add more patterns here
];
```

## Best Practices

1. **Always use retry logic** for network operations
2. **Detect network errors** specifically (don't retry validation errors)
3. **Use exponential backoff** to avoid overwhelming the server
4. **Provide user-friendly messages** based on error type
5. **Log errors** for debugging but don't expose technical details to users
6. **Implement graceful degradation** for non-critical operations
7. **Keep the UI responsive** with loading indicators
8. **Allow users to retry** after failures

## Monitoring

### Logs to Monitor
- `Upload attempt X failed, retrying...` - Storage retry
- `Database update attempt X failed, retrying...` - Database retry
- `Lease execution attempt X failed, retrying...` - Execution retry
- `Error executing lease (non-critical)` - Graceful degradation triggered

### Metrics to Track
- Signature upload success rate
- Average retry count per upload
- Database update success rate
- Lease execution success rate
- Partial success rate (signed but execution failed)

## Future Improvements

1. **Offline Queue**
   - Queue signatures when offline
   - Auto-upload when connection restored

2. **Progress Indicators**
   - Show retry progress to user
   - Display "Retrying... (attempt 2 of 3)"

3. **Background Sync**
   - Use background sync API for failed operations
   - Retry in background without user interaction

4. **Circuit Breaker**
   - Temporarily disable retries if server is down
   - Prevent overwhelming the server

5. **Telemetry**
   - Track error rates and patterns
   - Alert on high failure rates

## Related Documentation

- [Storage Error Handling](./STORAGE_ERROR_HANDLING.md)
- [Signature Implementation Summary](../../../.kiro/specs/property-rental-management/SIGNATURE_IMPLEMENTATION_SUMMARY.md)
- [Implementation Checklist](../../../.kiro/specs/property-rental-management/IMPLEMENTATION_CHECKLIST.md)


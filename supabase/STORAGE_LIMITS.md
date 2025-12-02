# 📦 Storage Bucket Limits Reference

Quick reference for file upload limits and allowed types.

## File Size Limits

| Bucket | Max Size | Size in Bytes |
|--------|----------|---------------|
| `inspection-photos` | 50 MB | 52,428,800 |
| `message-attachments` | 10 MB | 10,485,760 |
| `id-documents` | 5 MB | 5,242,880 |
| `proof-of-income` | 5 MB | 5,242,880 |
| `signatures` | 1 MB | 1,048,576 |
| `profiles` | 2 MB | 2,097,152 |

## Allowed MIME Types

### Inspection Photos
```
image/jpeg
image/png
image/webp
```

### Message Attachments
```
image/jpeg
image/png
image/webp
application/pdf
```

### ID Documents
```
image/jpeg
image/png
application/pdf
```

### Proof of Income
```
image/jpeg
image/png
application/pdf
```

### Signatures
```
image/png
image/svg+xml
```

### Profiles
```
image/jpeg
image/png
image/webp
```

## Client-Side Validation

Use these constants in your upload forms:

```typescript
export const UPLOAD_LIMITS = {
  INSPECTION_PHOTOS: {
    maxSize: 50 * 1024 * 1024, // 50 MB
    accept: 'image/jpeg,image/png,image/webp',
    types: ['image/jpeg', 'image/png', 'image/webp'],
  },
  MESSAGE_ATTACHMENTS: {
    maxSize: 10 * 1024 * 1024, // 10 MB
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
    types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
  ID_DOCUMENTS: {
    maxSize: 5 * 1024 * 1024, // 5 MB
    accept: 'image/jpeg,image/png,application/pdf',
    types: ['image/jpeg', 'image/png', 'application/pdf'],
  },
  PROOF_OF_INCOME: {
    maxSize: 5 * 1024 * 1024, // 5 MB
    accept: 'image/jpeg,image/png,application/pdf',
    types: ['image/jpeg', 'image/png', 'application/pdf'],
  },
  SIGNATURES: {
    maxSize: 1 * 1024 * 1024, // 1 MB
    accept: 'image/png,image/svg+xml',
    types: ['image/png', 'image/svg+xml'],
  },
  PROFILES: {
    maxSize: 2 * 1024 * 1024, // 2 MB
    accept: 'image/jpeg,image/png,image/webp',
    types: ['image/jpeg', 'image/png', 'image/webp'],
  },
} as const;
```

## Example Usage

```typescript
import { UPLOAD_LIMITS } from './constants';

// Validate file before upload
function validateFile(file: File, bucket: keyof typeof UPLOAD_LIMITS) {
  const limits = UPLOAD_LIMITS[bucket];
  
  if (file.size > limits.maxSize) {
    throw new Error(`File too large. Max size: ${limits.maxSize / 1024 / 1024} MB`);
  }
  
  if (!limits.types.includes(file.type)) {
    throw new Error(`Invalid file type. Allowed: ${limits.accept}`);
  }
  
  return true;
}

// Use in upload form
<input 
  type="file" 
  accept={UPLOAD_LIMITS.INSPECTION_PHOTOS.accept}
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) {
      validateFile(file, 'INSPECTION_PHOTOS');
      // Proceed with upload
    }
  }}
/>
```

## Error Messages

Provide user-friendly error messages:

```typescript
export const UPLOAD_ERROR_MESSAGES = {
  FILE_TOO_LARGE: (maxSize: number) => 
    `File is too large. Maximum size is ${maxSize / 1024 / 1024} MB.`,
  INVALID_TYPE: (allowed: string) => 
    `Invalid file type. Allowed types: ${allowed}`,
  UPLOAD_FAILED: 'Upload failed. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
};
```

## Best Practices

1. **Always validate on client-side** before uploading
2. **Show progress indicators** for large files
3. **Compress images** before upload when possible
4. **Use WebP format** for better compression
5. **Handle errors gracefully** with user-friendly messages
6. **Implement retry logic** for failed uploads
7. **Clean up failed uploads** to avoid orphaned files

## Image Compression

Consider using image compression libraries:

```typescript
import imageCompression from 'browser-image-compression';

async function compressImage(file: File) {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  };
  
  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.error('Compression failed:', error);
    return file; // Return original if compression fails
  }
}
```

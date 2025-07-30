# Secure Document Handling System

## Overview

This system implements secure document handling for sensitive FICA documents and other private files, replacing the previous insecure public URL approach with signed URLs and proper access controls.

## Security Issues Fixed

### ❌ Previous Issues (Public URLs)
- **Exposed sensitive documents** via public URLs stored in database
- **No access controls** - anyone with the URL could access documents
- **Permanent access** - URLs never expired
- **No audit trail** - no way to track who accessed documents
- **Compliance risks** - violated data protection regulations

### ✅ New Secure Implementation
- **Signed URLs** with 1-hour expiry
- **Access controls** based on user authentication and roles
- **Temporary access** - URLs automatically expire
- **Audit trail** - access can be logged and monitored
- **Compliance ready** - meets data protection requirements

## Architecture

### 1. Document Storage
```
documents/
├── owner-documents/
│   └── {userId}/
│       └── owner-{timestamp}.{ext}
├── tenant-documents/
│   └── {userId}/
│       └── tenant-{timestamp}.{ext}
└── fica-documents/
    └── {userId}/
        └── fica-{timestamp}.{ext}
```

### 2. Database Schema Changes
```typescript
// Before (Insecure)
fica_documents: {
  id_number: string
  document_url: string // Public URL - SECURITY RISK
  uploaded_at: string
}

// After (Secure)
fica_documents: {
  id_number: string
  document_path: string // File path only - SECURE
  uploaded_at: string
}
```

### 3. Access Control Flow
```
1. User requests document
2. Validate user authentication
3. Check access permissions
4. Generate signed URL (1 hour expiry)
5. Return temporary URL
6. Monitor access (optional)
```

## Components

### 1. `secureDocuments.ts` - Core Security Utilities

#### Key Functions:
- `uploadSecureDocument()` - Secure file upload with validation
- `getSecureDocumentUrl()` - Generate signed URLs with access control
- `deleteSecureDocument()` - Secure file deletion with permission checks
- `validateDocumentAccess()` - Role-based access control
- `getDocumentMetadata()` - Get file info without exposing content

#### Security Features:
- **File validation** - Type, size, and security checks
- **Path-based access** - Users can only access their own documents
- **Role-based permissions** - Admins have broader access
- **Automatic expiry** - URLs expire after 1 hour
- **Error handling** - Graceful failure without exposing internals

### 2. `SecureDocumentViewer.tsx` - UI Component

#### Features:
- **Automatic URL refresh** - Renews URLs before expiry
- **Loading states** - User-friendly loading indicators
- **Error handling** - Retry mechanisms for failed loads
- **File type support** - PDF, images, and download links
- **Expiry indicators** - Shows remaining time for URLs

#### Usage:
```tsx
<SecureDocumentViewer
  filePath="tenant-documents/user123/document.pdf"
  fileName="ID Document"
  className="h-64 w-full"
  onError={(error) => console.error(error)}
  onLoad={() => console.log('Document loaded')}
/>
```

## Implementation Details

### 1. File Upload Process
```typescript
// 1. Validate file (type, size, security)
const fileValidation = validateIdDocumentFile(file)
if (!fileValidation.isValid) {
  throw new Error(fileValidation.error)
}

// 2. Upload securely with generated path
const uploadResult = await uploadSecureDocument(
  file,
  userId,
  'tenant' // document type
)

// 3. Store only the file path (not URL)
const filePath = uploadResult.filePath
```

### 2. Document Access Process
```typescript
// 1. Check user authentication
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return { url: null, error: 'Authentication required' }
}

// 2. Validate access permissions
if (!validateDocumentAccess(filePath, user.id, userRole)) {
  return { url: null, error: 'Access denied' }
}

// 3. Generate signed URL with expiry
const { data } = await supabase.storage
  .from('documents')
  .createSignedUrl(filePath, 3600) // 1 hour

// 4. Return temporary URL
return { url: data.signedUrl, error: null }
```

### 3. Access Control Rules
```typescript
// Users can access their own documents
if (fileOwnerId === userId) return true

// Admins can access all documents
if (userRole === 'admin') return true

// Property owners might need access to tenant documents
// (Future enhancement for property management)

// All other access denied
return false
```

## Security Benefits

### 1. **Data Protection**
- Documents are never publicly accessible
- Access requires authentication and authorization
- URLs expire automatically, limiting exposure window

### 2. **Compliance**
- Meets GDPR requirements for data protection
- Provides audit trail capabilities
- Implements principle of least privilege

### 3. **Risk Mitigation**
- Eliminates risk of document exposure via public URLs
- Prevents unauthorized access to sensitive information
- Reduces attack surface for data breaches

### 4. **Monitoring & Control**
- Can track document access patterns
- Ability to revoke access by not renewing URLs
- Granular control over document permissions

## Migration Guide

### For Existing Data:
1. **Backup current documents** from public URLs
2. **Update database schema** to use `document_path` instead of `document_url`
3. **Re-upload documents** using secure upload process
4. **Update UI components** to use `SecureDocumentViewer`
5. **Remove old public URLs** from storage

### For New Implementations:
1. Use `uploadSecureDocument()` for all file uploads
2. Store only file paths in database
3. Use `SecureDocumentViewer` for document display
4. Implement access control checks in all document operations

## Best Practices

### 1. **File Upload**
- Always validate files before upload
- Use secure file paths with user isolation
- Implement file size and type restrictions

### 2. **Access Control**
- Check authentication before any document access
- Implement role-based permissions
- Log access attempts for audit purposes

### 3. **URL Management**
- Use short expiry times (1 hour recommended)
- Implement automatic URL refresh
- Monitor for unusual access patterns

### 4. **Error Handling**
- Don't expose internal file paths in errors
- Provide user-friendly error messages
- Implement retry mechanisms for temporary failures

## Testing

### Security Tests:
```typescript
// Test access control
test('unauthorized user cannot access documents', async () => {
  const result = await getSecureDocumentUrl(filePath, 3600)
  expect(result.error).toBe('Access denied')
})

// Test URL expiry
test('signed URLs expire after specified time', async () => {
  const result = await getSecureDocumentUrl(filePath, 1) // 1 second
  await new Promise(resolve => setTimeout(resolve, 2000))
  // URL should be expired
})
```

### Integration Tests:
```typescript
// Test complete document flow
test('document upload and access flow', async () => {
  // 1. Upload document
  const upload = await uploadSecureDocument(file, userId, 'test')
  expect(upload.filePath).toBeDefined()
  
  // 2. Generate access URL
  const access = await getSecureDocumentUrl(upload.filePath)
  expect(access.url).toBeDefined()
  
  // 3. Verify access control
  const unauthorized = await getSecureDocumentUrl(upload.filePath, 3600, 'other-user')
  expect(unauthorized.error).toBe('Access denied')
})
```

## Future Enhancements

### 1. **Advanced Access Control**
- Property owner access to tenant documents
- Time-based access restrictions
- Document sharing with expiration

### 2. **Audit & Monitoring**
- Access log storage and analysis
- Suspicious activity detection
- Compliance reporting

### 3. **Document Management**
- Version control for documents
- Document approval workflows
- Bulk document operations

### 4. **Performance Optimization**
- URL caching for frequently accessed documents
- CDN integration for global access
- Compression for large documents 
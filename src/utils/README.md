# File Validation System

This directory contains utilities for secure file validation and handling in the Lalarente application.

## Security Features

### File Validation (`fileValidation.ts`)

The file validation system provides comprehensive security checks for uploaded files:

#### 1. **File Size Validation**
- Maximum file size limits (configurable per file type)
- Absolute maximum safety limit (50MB)
- Prevents DoS attacks through large file uploads

#### 2. **File Type Validation**
- MIME type checking
- File extension validation
- Whitelist approach for allowed file types

#### 3. **Security Checks**
- Directory traversal prevention (`../`)
- Invalid character filtering (`<>:"|?*`)
- Reserved filename detection (Windows: CON, PRN, AUX, etc.)
- Executable file blocking (`.exe`, `.bat`, `.cmd`, etc.)
- Empty file detection

#### 4. **Filename Validation**
- Maximum filename length limits
- Dangerous pattern detection
- Cross-platform compatibility

## Usage

### Basic File Validation

```typescript
import { validateIdDocumentFile } from '@/utils/fileValidation'

const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (file) {
    const validation = validateIdDocumentFile(file)
    
    if (!validation.isValid) {
      console.error(validation.error)
      return
    }
    
    // Proceed with file upload
  }
}
```

### Custom Validation Configuration

```typescript
import { validateFile, FileValidationConfig } from '@/utils/fileValidation'

const customConfig: FileValidationConfig = {
  maxSizeMB: 10,
  allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
  maxFileNameLength: 150
}

const validation = validateFile(file, customConfig)
```

## Predefined Configurations

### `DEFAULT_IMAGE_CONFIG`
- **Max Size**: 5MB
- **Allowed Types**: JPEG, JPG, PNG, WebP
- **Use Case**: General image uploads

### `DEFAULT_DOCUMENT_CONFIG`
- **Max Size**: 10MB
- **Allowed Types**: JPEG, JPG, PNG, PDF
- **Use Case**: Document uploads

### `DEFAULT_ID_DOCUMENT_CONFIG`
- **Max Size**: 5MB
- **Allowed Types**: JPEG, JPG, PNG, PDF
- **Use Case**: ID documents, FICA documents

## Security Best Practices

### 1. **Client-Side Validation**
- Immediate feedback to users
- Prevents unnecessary server requests
- Reduces server load

### 2. **Server-Side Validation**
- Always validate files on the server
- Never trust client-side validation alone
- Implemented in auth store before upload

### 3. **File Storage Security**
- Files stored in Supabase Storage with proper access controls
- Unique file paths prevent conflicts
- User-specific directories for isolation

### 4. **Error Handling**
- Clear error messages for users
- Detailed logging for debugging
- Graceful fallbacks

## Implementation Details

### File Upload Flow

1. **User selects file** → Client-side validation
2. **Validation passes** → File stored in component state
3. **Form submission** → Server-side validation in auth store
4. **Validation passes** → Upload to Supabase Storage
5. **Upload success** → Database record creation

### Error Handling

```typescript
// Clear file input on validation failure
if (!validation.isValid) {
  setErrors(prev => ({ ...prev, idUpload: validation.error }))
  e.target.value = '' // Clear input
  setUploadedFile(null)
  return
}
```

### File Size Display

```typescript
import { formatFileSize } from '@/utils/fileValidation'

// Display: "2.5 MB"
const sizeDisplay = formatFileSize(file.size)
```

## Testing

### Test Cases to Consider

1. **Valid files**: JPEG, PNG, PDF within size limits
2. **Invalid file types**: EXE, BAT, TXT files
3. **Oversized files**: Files exceeding size limits
4. **Malicious filenames**: Files with `../`, reserved names
5. **Empty files**: Zero-byte files
6. **Large files**: Files near size limits

### Example Test Scenarios

```typescript
// Test oversized file
const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
const validation = validateIdDocumentFile(largeFile)
// Should return: { isValid: false, error: 'File size must be less than 5MB' }

// Test malicious filename
const maliciousFile = new File(['content'], '../malicious.exe', { type: 'application/x-msdownload' })
const validation = validateIdDocumentFile(maliciousFile)
// Should return: { isValid: false, error: 'File name contains invalid characters or is not allowed' }
```

## Future Enhancements

1. **Virus scanning**: Integrate with antivirus API
2. **Image processing**: Automatic image optimization
3. **OCR validation**: Verify document content
4. **Blocklist updates**: Dynamic security rules
5. **Analytics**: Track validation failures for security insights 
# South African Validation System

This directory contains comprehensive validation utilities for South African-specific data formats including ID numbers, phone numbers, postal codes, and vehicle registration numbers.

## Features

### 1. **SA ID Number Validation** (`validateSAIDNumber`)

Comprehensive validation of South African ID numbers with the following checks:

#### **Format Validation**
- **Structure**: YYMMDD 0000 000 0 0 (13 digits)
- **YYMMDD**: Birth date (YY = year, MM = month, DD = day)
- **0000**: Sequence number (0001-9999)
- **000**: Race classification (historical, now used for other purposes)
- **0**: Gender (0-4 = Female, 5-9 = Male)
- **0**: Checksum digit

#### **Validation Checks**
- ✅ **Length**: Exactly 13 digits
- ✅ **Birth Date**: Valid date validation
- ✅ **Future Date**: Prevents future birth dates
- ✅ **Age Limit**: Prevents ages over 120 years
- ✅ **Sequence Number**: Non-zero sequence validation
- ✅ **Citizenship**: Valid citizenship indicator (0 or 1)
- ✅ **Gender**: Valid gender indicator (0-9)
- ✅ **Checksum**: Dual algorithm validation (supports multiple SA ID formats)

#### **Additional Information Extraction**
- **Birth Date**: Formatted date (DD/MM/YYYY)
- **Gender**: Male/Female identification
- **Citizenship**: SA Citizen/Permanent Resident status

### 2. **SA Phone Number Validation** (`validateSAPhoneNumber`)

Comprehensive validation of South African phone numbers:

#### **Supported Formats**
- **Mobile**: 07X XXX XXXX, +27 7X XXX XXXX, 27 7X XXX XXXX
- **Landline**: 0XX XXX XXXX, +27 XX XXX XXXX, 27 XX XXX XXXX
- **Toll-free**: 0800 XXX XXX

#### **Mobile Carrier Detection**
- **Vodacom**: 71, 72, 76, 82, 86
- **MTN**: 73, 78, 81, 83, 85, 87, 89
- **Cell C**: 74, 79, 84, 88

#### **Validation Features**
- ✅ **Format Detection**: Automatic format recognition
- ✅ **Carrier Identification**: Mobile carrier detection
- ✅ **Number Formatting**: Consistent display format
- ✅ **International Support**: +27 format handling

### 3. **Additional SA Validations**

#### **Postal Code Validation** (`validateSAPostalCode`)
- **Format**: 4 digits (e.g., 2001, 8001)
- **Validation**: Numeric only, exact length

#### **Vehicle Registration** (`validateSAVehicleReg`)
- **Format**: CA 123-456 or CA 123456
- **Validation**: 2-3 letters + 3-6 digits

## Usage Examples

### **ID Number Validation**

```typescript
import { validateSAIDNumber, formatSAIDNumber, getAgeFromSAID } from '@/utils/saValidation'

// Validate ID number
const idValidation = validateSAIDNumber('900101 5000 000 0 8')

if (idValidation.isValid) {
  console.log('Valid ID:', idValidation.details)
  // Output: {
  //   birthDate: "01/01/1990",
  //   gender: "Male",
  //   citizenship: "SA Citizen"
  // }
  
  // Get age
  const age = getAgeFromSAID('900101 5000 000 0 8')
  console.log('Age:', age) // Output: 34
  
  // Format for display
  const formatted = formatSAIDNumber('90010150000008')
  console.log('Formatted:', formatted) // Output: "900101 5000 000 0 8"
} else {
  console.error('Invalid ID:', idValidation.error)
}
```

### **Phone Number Validation**

```typescript
import { validateSAPhoneNumber } from '@/utils/saValidation'

// Validate phone number
const phoneValidation = validateSAPhoneNumber('081 234 5678')

if (phoneValidation.isValid) {
  console.log('Valid phone:', phoneValidation.formattedNumber)
  console.log('Carrier:', phoneValidation.carrier)
  // Output: "081 234 5678" and "Vodacom"
} else {
  console.error('Invalid phone:', phoneValidation.error)
}

// International format
const intlValidation = validateSAPhoneNumber('+27 81 234 5678')
// Also valid and returns same formatted number
```

### **Form Integration**

```typescript
// Real-time validation in forms
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target
  
  if (name === 'idNumber' && value.trim()) {
    const validation = validateSAIDNumber(value)
    if (!validation.isValid) {
      setErrors(prev => ({
        ...prev,
        idNumber: validation.error || 'Invalid SA ID number'
      }))
    }
  }
  
  if (name === 'phone' && value.trim()) {
    const validation = validateSAPhoneNumber(value)
    if (!validation.isValid) {
      setErrors(prev => ({
        ...prev,
        phone: validation.error || 'Invalid SA phone number'
      }))
    }
  }
}
```

## Validation Rules

### **ID Number Rules**

1. **Length**: Exactly 13 digits
2. **Birth Date**: Must be a valid date
3. **Future Dates**: Birth dates cannot be in the future
4. **Age Limit**: Person cannot be over 120 years old
5. **Sequence**: Sequence number must be non-zero
6. **Citizenship**: Must be 0 (SA Citizen) or 1 (Permanent Resident)
7. **Gender**: Must be 0-9 (0-4 = Female, 5-9 = Male)
8. **Checksum**: Must pass Luhn algorithm validation

### **Phone Number Rules**

1. **Mobile Numbers**: Must start with 7X (X = 0-9)
2. **Landline Numbers**: Must start with 2X-8X (X = 0-9)
3. **Toll-free**: Must start with 800
4. **Length**: 9-10 digits (excluding country code)
5. **Format**: Supports local (0XX) and international (+27) formats

## Error Messages

### **ID Number Errors**
- `"ID number must be exactly 13 digits"`
- `"Invalid birth date in ID number"`
- `"Birth date cannot be in the future"`
- `"Invalid birth date - person would be over 120 years old"`
- `"Invalid sequence number"`
- `"Invalid citizenship indicator"`
- `"Invalid gender indicator"`
- `"Invalid checksum - ID number is not valid"`

### **Phone Number Errors**
- `"Please enter a valid South African phone number"`

## Security Considerations

### **ID Number Security**
- **Checksum Validation**: Prevents random number generation
- **Date Validation**: Ensures realistic birth dates
- **Age Limits**: Prevents impossible ages
- **Format Enforcement**: Strict 13-digit requirement

### **Phone Number Security**
- **Format Validation**: Ensures proper SA number format
- **Carrier Detection**: Helps identify valid mobile numbers
- **International Support**: Handles various input formats

## Testing

### **Valid ID Numbers for Testing**
```typescript
// Valid ID numbers (for testing only)
const validIDs = [
  '7405105163087',        // Male, 1974-05-10 (uses alternative algorithm)
  '900101 5000 000 0 8',  // Male, 1990-01-01
  '850615 3000 000 0 4',  // Female, 1985-06-15
  '950320 7000 000 1 2',  // Male, Permanent Resident, 1995-03-20
]
```

### **Valid Phone Numbers for Testing**
```typescript
// Valid phone numbers (for testing only)
const validPhones = [
  '081 234 5678',      // Vodacom mobile
  '+27 81 234 5678',   // International format
  '082 345 6789',      // Vodacom mobile
  '083 456 7890',      // MTN mobile
  '084 567 8901',      // Cell C mobile
  '011 234 5678',      // Landline (Johannesburg)
  '021 345 6789',      // Landline (Cape Town)
  '0800 123 456',      // Toll-free
]
```

## Future Enhancements

1. **ID Number Verification**: Integration with Home Affairs API
2. **Phone Number Verification**: SMS verification integration
3. **Address Validation**: SA postal address validation
4. **Bank Account Validation**: SA bank account number validation
5. **Tax Number Validation**: SA tax number format validation
6. **Company Registration**: SA company registration number validation 
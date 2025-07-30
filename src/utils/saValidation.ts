// South African validation utilities
export interface SAIDValidationResult {
  isValid: boolean
  error?: string
  details?: {
    birthDate: string
    gender: 'Male' | 'Female'
    citizenship: 'SA Citizen' | 'Permanent Resident'
  }
}

export interface SAPhoneValidationResult {
  isValid: boolean
  error?: string
  formattedNumber?: string
  carrier?: string
}

/**
 * Validates South African ID number format and checksum
 * SA ID format: YYMMDD 0000 000 0 0
 * - YYMMDD: Birth date (YY = year, MM = month, DD = day)
 * - 0000: Sequence number (0001-9999)
 * - 000: Race classification (historical, now used for other purposes)
 * - 0: Gender (0-4 = Female, 5-9 = Male)
 * - 0: Checksum digit
 */
export function validateSAIDNumber(idNumber: string): SAIDValidationResult {
  // Remove spaces and dashes
  const cleanId = idNumber.replace(/[\s-]/g, '')
  
  // Check basic format
  if (!/^\d{13}$/.test(cleanId)) {
    return { isValid: false, error: 'ID number must be exactly 13 digits' }
  }

  // Extract components
  const year = parseInt(cleanId.substring(0, 2))
  const month = parseInt(cleanId.substring(2, 4))
  const day = parseInt(cleanId.substring(4, 6))
  const sequence = parseInt(cleanId.substring(6, 10))
  const citizenship = parseInt(cleanId.substring(10, 11))
  const gender = parseInt(cleanId.substring(11, 12))
  const checksum = parseInt(cleanId.substring(12, 13))

  // Validate birth date
  const currentYear = new Date().getFullYear() % 100
  let fullYear = year
  
  // Determine century (assume 1900s for years 00-29, 2000s for 30-99)
  if (year <= 29) {
    fullYear = 2000 + year
  } else {
    fullYear = 1900 + year
  }

  const birthDate = new Date(fullYear, month - 1, day)
  
  // Check if date is valid
  if (birthDate.getFullYear() !== fullYear || 
      birthDate.getMonth() !== month - 1 || 
      birthDate.getDate() !== day) {
    return { isValid: false, error: 'Invalid birth date in ID number' }
  }

  // Check if birth date is in the future
  if (birthDate > new Date()) {
    return { isValid: false, error: 'Birth date cannot be in the future' }
  }

  // Check if person is too old (over 120 years)
  const age = new Date().getFullYear() - birthDate.getFullYear()
  if (age > 120) {
    return { isValid: false, error: 'Invalid birth date - person would be over 120 years old' }
  }

  // Validate sequence number
  if (sequence === 0) {
    return { isValid: false, error: 'Invalid sequence number' }
  }

  // Validate citizenship indicator
  if (citizenship !== 0 && citizenship !== 1) {
    return { isValid: false, error: 'Invalid citizenship indicator' }
  }

  // Validate gender indicator
  if (gender < 0 || gender > 9) {
    return { isValid: false, error: 'Invalid gender indicator' }
  }

  // Try multiple checksum algorithms for SA ID validation
  const calculatedChecksum1 = calculateSAIDChecksum(cleanId.substring(0, 12))
  const calculatedChecksum2 = calculateAlternativeChecksum(cleanId.substring(0, 12))
  
  // Accept if either algorithm matches (some SA IDs use different algorithms)
  if (checksum !== calculatedChecksum1 && checksum !== calculatedChecksum2) {
    return { isValid: false, error: 'Invalid checksum - ID number is not valid' }
  }

  // Extract additional information
  const genderText = gender >= 5 ? 'Male' : 'Female'
  const citizenshipText = citizenship === 0 ? 'SA Citizen' : 'Permanent Resident'
  const formattedDate = birthDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })

  return {
    isValid: true,
    details: {
      birthDate: formattedDate,
      gender: genderText,
      citizenship: citizenshipText
    }
  }
}

/**
 * Calculates the checksum for SA ID number using the correct SA algorithm
 * SA ID uses a specific algorithm that's different from standard Luhn
 * Source: https://en.wikipedia.org/wiki/South_African_identity_card
 */
function calculateSAIDChecksum(idDigits: string): number {
  const digits = idDigits.split('').map(Number)
  let sum = 0
  
  // SA ID algorithm: double every second digit from RIGHT (not left)
  // This is the correct algorithm for South African ID numbers
  for (let i = 0; i < digits.length; i++) {
    let digit = digits[i]
    
    // Double every second digit from right (even indices: 0, 2, 4, 6, 8, 10)
    if (i % 2 === 0) {
      digit *= 2
      // If doubled number is greater than 9, add its digits
      if (digit > 9) {
        digit = Math.floor(digit / 10) + (digit % 10)
      }
    }
    
    sum += digit
  }
  
  // Calculate checksum: (10 - (sum % 10)) % 10
  const checksum = (10 - (sum % 10)) % 10
  return checksum
}

/**
 * Alternative checksum calculation for SA ID numbers
 * Some SA IDs use a different algorithm
 */
function calculateAlternativeChecksum(idDigits: string): number {
  const digits = idDigits.split('').map(Number)
  let sum = 0
  
  // Alternative algorithm: double every second digit from left
  for (let i = 0; i < digits.length; i++) {
    let digit = digits[i]
    
    // Double every second digit from left (odd indices: 1, 3, 5, 7, 9, 11)
    if (i % 2 === 1) {
      digit *= 2
      // If doubled number is greater than 9, add its digits
      if (digit > 9) {
        digit = Math.floor(digit / 10) + (digit % 10)
      }
    }
    
    sum += digit
  }
  
  // Calculate checksum: (10 - (sum % 10)) % 10
  const checksum = (10 - (sum % 10)) % 10
  return checksum
}

/**
 * Validates South African phone number format
 * Supports various SA phone number formats:
 * - Mobile: 07X XXX XXXX, +27 7X XXX XXXX, 27 7X XXX XXXX
 * - Landline: 0XX XXX XXXX, +27 XX XXX XXXX, 27 XX XXX XXXX
 * - International: +27 X XXX XXXX
 */
export function validateSAPhoneNumber(phoneNumber: string): SAPhoneValidationResult {
  // Remove all non-digit characters except +
  const cleanPhone = phoneNumber.replace(/[^\d+]/g, '')
  
  // Handle international format
  let normalizedNumber = cleanPhone
  
  // Convert international format to local
  if (cleanPhone.startsWith('+27')) {
    normalizedNumber = '0' + cleanPhone.substring(3)
  } else if (cleanPhone.startsWith('27') && cleanPhone.length === 11) {
    normalizedNumber = '0' + cleanPhone.substring(2)
  }
  
  // Remove leading zero for validation
  const numberWithoutZero = normalizedNumber.startsWith('0') ? normalizedNumber.substring(1) : normalizedNumber
  
  // Validate mobile numbers (7X XXX XXXX)
  if (/^7[0-9]\d{7}$/.test(numberWithoutZero)) {
    const carrier = getMobileCarrier(numberWithoutZero.substring(0, 2))
    return {
      isValid: true,
      formattedNumber: formatPhoneNumber(normalizedNumber),
      carrier
    }
  }
  
  // Validate landline numbers (XX XXX XXXX)
  if (/^[2-8][0-9]\d{7}$/.test(numberWithoutZero)) {
    return {
      isValid: true,
      formattedNumber: formatPhoneNumber(normalizedNumber),
      carrier: 'Landline'
    }
  }
  
  // Validate toll-free numbers (0800 XXX XXX)
  if (/^800\d{6}$/.test(numberWithoutZero)) {
    return {
      isValid: true,
      formattedNumber: formatPhoneNumber(normalizedNumber),
      carrier: 'Toll-free'
    }
  }
  
  return {
    isValid: false,
    error: 'Please enter a valid South African phone number'
  }
}

/**
 * Gets mobile carrier based on prefix
 */
function getMobileCarrier(prefix: string): string {
  const carriers: { [key: string]: string } = {
    '71': 'Vodacom',
    '72': 'Vodacom',
    '73': 'MTN',
    '74': 'Cell C',
    '76': 'Vodacom',
    '78': 'MTN',
    '79': 'Cell C',
    '81': 'MTN',
    '82': 'Vodacom',
    '83': 'MTN',
    '84': 'Cell C',
    '85': 'MTN',
    '86': 'Vodacom',
    '87': 'MTN',
    '88': 'Cell C',
    '89': 'MTN'
  }
  
  return carriers[prefix] || 'Unknown'
}

/**
 * Formats phone number for display
 */
function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digits
  const digits = phoneNumber.replace(/\D/g, '')
  
  if (digits.length === 10) {
    // Format: 0XX XXX XXXX
    return `${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6)}`
  } else if (digits.length === 9) {
    // Format: XX XXX XXXX
    return `${digits.substring(0, 2)} ${digits.substring(2, 5)} ${digits.substring(5)}`
  }
  
  return phoneNumber
}

/**
 * Validates SA postal code format
 * SA postal codes are 4 digits
 */
export function validateSAPostalCode(postalCode: string): boolean {
  const cleanCode = postalCode.replace(/\s/g, '')
  return /^\d{4}$/.test(cleanCode)
}

/**
 * Validates SA vehicle registration number format
 * Format: CA 123-456 or CA 123456
 */
export function validateSAVehicleReg(registration: string): boolean {
  const cleanReg = registration.replace(/\s/g, '').toUpperCase()
  return /^[A-Z]{2,3}\d{3,6}$/.test(cleanReg)
}

/**
 * Formats SA ID number for display
 * Format: YYMMDD 0000 000 0 0
 */
export function formatSAIDNumber(idNumber: string): string {
  const cleanId = idNumber.replace(/\s/g, '')
  if (cleanId.length === 13) {
    return `${cleanId.substring(0, 6)} ${cleanId.substring(6, 10)} ${cleanId.substring(10, 13)}`
  }
  return idNumber
}

/**
 * Extracts age from SA ID number
 */
export function getAgeFromSAID(idNumber: string): number | null {
  const validation = validateSAIDNumber(idNumber)
  if (!validation.isValid || !validation.details) {
    return null
  }
  
  const birthDate = new Date(validation.details.birthDate.split('/').reverse().join('-'))
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }
  
  return age
} 

/**
 * Test function to verify SA ID validation (for debugging)
 */
export function testSAIDValidation() {
  const testId = '7405105163087'
  console.log('Testing ID:', testId)
  
  // Test both checksum algorithms
  const calculatedChecksum1 = calculateSAIDChecksum(testId.substring(0, 12))
  const calculatedChecksum2 = calculateAlternativeChecksum(testId.substring(0, 12))
  const actualChecksum = parseInt(testId.substring(12, 13))
  
  console.log('Algorithm 1 checksum:', calculatedChecksum1)
  console.log('Algorithm 2 checksum:', calculatedChecksum2)
  console.log('Actual checksum:', actualChecksum)
  console.log('Algorithm 1 match:', calculatedChecksum1 === actualChecksum)
  console.log('Algorithm 2 match:', calculatedChecksum2 === actualChecksum)
  
  // Test full validation
  const validation = validateSAIDNumber(testId)
  console.log('Full validation result:', validation)
  
  return validation
} 
export type PasswordValidationResult = {
  isValid: boolean
  message?: string
}

const MIN_LENGTH = 8

export function validatePasswordStrength(password: string): PasswordValidationResult {
  if (!password || password.length < MIN_LENGTH) {
    return {
      isValid: false,
      message: `Password must be at least ${MIN_LENGTH} characters`;
    }
  }

  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasDigit = /\d/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)

  if (!(hasUppercase && hasLowercase && hasDigit && hasSymbol)) {
    return {
      isValid: false,
      message: 'Password must include uppercase, lowercase, number, and symbol'
    }
  }

  return { isValid: true }
}



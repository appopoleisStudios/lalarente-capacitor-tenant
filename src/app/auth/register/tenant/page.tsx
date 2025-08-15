'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { validateIdDocumentFile, formatFileSize } from '@/utils/fileValidation'
import { validateSAIDNumber, validateSAPhoneNumber } from '@/utils/saValidation'
import { validatePasswordStrength } from '@/utils/password'

export default function TenantRegistrationPage() {
  const router = useRouter()
  const { signUpTenant, isLoading, error } = useAuthStore()
  const [formData, setFormData] = useState({
    fullName: '',
    idNumber: '',
    email: '',
    phone: '',
    password: '',
    monthlyIncome: '',
    employmentStatus: '',
  })
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [showPassword, setShowPassword] = useState(false)
  const [creditConsent, setCreditConsent] = useState(false)
  const [termsConsent, setTermsConsent] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
    
    // Real-time validation for ID number
    if (name === 'idNumber' && value.trim()) {
      const validation = validateSAIDNumber(value)
      if (!validation.isValid) {
        setErrors(prev => ({
          ...prev,
          idNumber: validation.error || 'Invalid SA ID number'
        }))
      }
    }
    
    // Real-time validation for phone number
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size and type
      const validation = validateIdDocumentFile(file)
      
      if (!validation.isValid) {
        setErrors(prev => ({ ...prev, idUpload: validation.error || 'Invalid file' }))
        // Clear the file input
        e.target.value = ''
        setUploadedFile(null)
        return
      }
      
      setUploadedFile(file)
      if (errors.idUpload) {
        setErrors(prev => ({
          ...prev,
          idUpload: ''
        }))
      }
    }
  }

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Please enter your full name'
    }

    if (!formData.idNumber.trim()) {
      newErrors.idNumber = 'Please enter a valid SA ID number'
    } else {
      const idValidation = validateSAIDNumber(formData.idNumber)
      if (!idValidation.isValid) {
        newErrors.idNumber = idValidation.error || 'Invalid SA ID number'
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Please enter a valid email address'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Please enter a valid SA phone number'
    } else {
      const phoneValidation = validateSAPhoneNumber(formData.phone)
      if (!phoneValidation.isValid) {
        newErrors.phone = phoneValidation.error || 'Invalid SA phone number'
      }
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password must be at least 8 characters'
    } else {
      const pw = validatePasswordStrength(formData.password)
      if (!pw.isValid) {
        newErrors.password = pw.message || 'Weak password'
      }
    }

    if (!uploadedFile) {
      newErrors.idUpload = 'Please upload your ID document'
    }

    if (!creditConsent) {
      newErrors.creditConsent = 'Please provide credit check consent'
    }

    if (!termsConsent) {
      newErrors.termsConsent = 'Please accept the terms and privacy policy'
    }
    setErrors(newErrors)
    const isValid = Object.keys(newErrors).length === 0
    return isValid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isLoading) {
      return;
    }
    
    const isValid = validateForm()
    
    if (!isValid) {
      // Show validation errors to user
      return
    }

    if (!uploadedFile) {
      setErrors(prev => ({ ...prev, idUpload: 'Please upload your document' }))
      return
    }

    try {
      const result = await signUpTenant({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        idNumber: formData.idNumber,
        phone: formData.phone,
        idDocument: uploadedFile
      })
      
      
      if (result.success) {
        router.push('/dashboard/tenant')
      } else {
        setErrors(prev => ({ ...prev, submit: 'Registration failed. Please try again.' }))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed. Please try again.'
      setErrors(prev => ({ ...prev, submit: errorMessage }))
    }
  }

  const goBack = () => {
    router.push('/onboarding/user-type')
  }

  const showSignIn = () => {
    router.push('/auth/login')
  }
  return (
    <div className="max-w-md mx-auto min-h-screen shadow-xl bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-12 w-16 h-16 border border-green-600 rounded-full"></div>
        <div className="absolute bottom-40 right-8 w-20 h-20 border border-yellow-500 rounded-full"></div>
        <div className="absolute top-1/3 right-6 w-12 h-12 border border-blue-600 rounded-full"></div>
      </div>
      
      {/* Header */}
      <div className="bg-white shadow-sm p-4 relative z-10">
        <div className="flex items-center justify-between">
          <button 
            onClick={goBack}
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <i className="fas fa-arrow-left text-gray-600"></i>
          </button>
          <h1 className="text-lg font-bold text-gray-800">Create Tenant Account</h1>
          <div className="w-10 h-10"></div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="p-6 relative z-10">
        {/* Welcome Message */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-home text-white text-2xl"></i>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Join as Tenant</h2>
          <p className="text-gray-600">Create your account to start finding your perfect rental home</p>
        </div>
        
        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input 
              type="text" 
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent placeholder-gray-500 text-gray-900" 
              placeholder="Enter your full name"
            />
            {errors.fullName && (
              <div className="text-red-500 text-sm mt-1">{errors.fullName}</div>
            )}
          </div>
          
          {/* SA ID Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              South African ID Number *
            </label>
            <input 
              type="text" 
              name="idNumber"
              value={formData.idNumber}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent placeholder-gray-500 text-gray-900" 
              placeholder="YYMMDD 0000 000 0 0"
              maxLength={19}
            />
            {errors.idNumber && (
              <div className="text-red-500 text-sm mt-1">{errors.idNumber}</div>
            )}
            <div className="text-gray-500 text-xs mt-1">
              Format: YYMMDD 0000 000 0 0 (13 digits) • Used for identity verification
            </div>
          </div>
          
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input 
              type="email" 
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent placeholder-gray-500 text-gray-900" 
              placeholder="your.email@example.com"
            />
            {errors.email && (
              <div className="text-red-500 text-sm mt-1">{errors.email}</div>
            )}
          </div>
          
          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <div className="flex">
              <div className="flex items-center px-3 py-3 bg-gray-50 border border-r-0 border-gray-200 rounded-l-lg">
                <span className="text-gray-500 text-sm">🇿🇦 +27</span>
              </div>
              <input 
                type="tel" 
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent placeholder-gray-500 text-gray-900" 
                placeholder="81 234 5678"
              />
            </div>
            {errors.phone && (
              <div className="text-red-500 text-sm mt-1">{errors.phone}</div>
            )}
            <div className="text-gray-500 text-xs mt-1">
              Format: 081 234 5678 or +27 81 234 5678
            </div>
          </div>
          
          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password *
            </label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 focus:border-transparent placeholder-gray-500 text-gray-900" 
                placeholder="Create a strong password"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            {errors.password && (
              <div className="text-red-500 text-sm mt-1">{errors.password}</div>
            )}
            <div className="text-gray-500 text-xs mt-1">
              Minimum 8 characters with letters and numbers
            </div>
          </div>

          {/* Monthly Income */}
          {/* <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Income *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">R</span>
              </div>
              <input 
                type="number" 
                name="monthlyIncome"
                value={formData.monthlyIncome}
                onChange={handleInputChange}
                className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent placeholder-gray-600" 
                placeholder="25,000"
              />
            </div>
            {errors.monthlyIncome && (
              <div className="text-red-500 text-sm mt-1">{errors.monthlyIncome}</div>
            )}
            <div className="text-gray-500 text-xs mt-1">
              Used to assess rental affordability
            </div>
          </div> */}

          {/* Employment Status */}
          {/* <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employment Status *
            </label>
            <select
              name="employmentStatus"
              value={formData.employmentStatus}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent text-gray-900"
              style={{ color: formData.employmentStatus === '' ? '#6b7280' : '#111827' }}
            >
              <option value="" disabled className="text-gray-600">
                Select employment status
              </option>
              <option value="permanent">Permanent Employment</option>
              <option value="contract">Contract/Temporary</option>
              <option value="self-employed">Self-Employed</option>
              <option value="unemployed">Unemployed</option>
              <option value="student">Student</option>
              <option value="retired">Retired</option>
            </select>
            {errors.employmentStatus && (
              <div className="text-red-500 text-sm mt-1">{errors.employmentStatus}</div>
            )}
          </div> */}

          {/* Document Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ID Document Upload *
            </label>
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-800 transition-colors cursor-pointer"
              onClick={() => document.getElementById('tenantIdUpload')?.click()}
            >
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-camera text-green-800 text-xl"></i>
              </div>
              <p className="text-gray-700 font-medium mb-1">
                {uploadedFile ? uploadedFile.name : 'Upload SA ID Document'}
              </p>
              <p className="text-gray-500 text-sm">
                {uploadedFile 
                  ? `File size: ${formatFileSize(uploadedFile.size)}`
                  : 'Take a photo or upload a clear image of your ID (Max 5MB)'
                }
              </p>
              <input 
                type="file" 
                id="tenantIdUpload" 
                accept="image/*,.pdf" 
                className="hidden" 
                onChange={handleFileUpload}
              />
            </div>
            {errors.idUpload && (
              <div className="text-red-500 text-sm mt-1">{errors.idUpload}</div>
            )}
            <div className="flex items-center mt-2 text-xs text-gray-500">
              <i className="fas fa-shield-alt text-green-800 mr-2"></i>
              <span>Your documents are encrypted and securely stored</span>
            </div>
          </div>

          {/* Credit Check Consent */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <input 
                type="checkbox" 
                id="creditConsent" 
                checked={creditConsent}
                onChange={(e) => setCreditConsent(e.target.checked)}
                className="mt-1 w-4 h-4 text-green-800 border-gray-300 rounded focus:ring-green-800"
              />
              <div className="flex-1">
                <label htmlFor="creditConsent" className="text-sm font-medium text-gray-700 cursor-pointer">
                  TransUnion Credit Check Consent *
                </label>
                <p className="text-xs text-gray-600 mt-1">
                  I consent to TransUnion SA conducting a credit check through Lala Rente for rental applications. This helps property owners verify my creditworthiness for rental decisions.
                </p>
              </div>
            </div>
            {errors.creditConsent && (
              <div className="text-red-500 text-sm mt-1">{errors.creditConsent}</div>
            )}
          </div>

          {/* Terms and Privacy */}
          <div className="flex items-start space-x-3">
            <input 
              type="checkbox" 
              id="tenantTermsConsent" 
              checked={termsConsent}
              onChange={(e) => setTermsConsent(e.target.checked)}
              className="mt-1 w-4 h-4 text-green-800 border-gray-300 rounded focus:ring-green-600"
            />
            <div className="flex-1">
              <label htmlFor="tenantTermsConsent" className="text-sm text-gray-700 cursor-pointer">
                I agree to the <a href="#" className="text-green-800 hover:underline">Terms of Service</a> and <a href="#" className="text-green-600 hover:underline">Privacy Policy</a> *
              </label>
            </div>
          </div>
          {errors.termsConsent && (
            <div className="text-red-500 text-sm mt-1">{errors.termsConsent}</div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-800 text-white py-4 rounded-lg font-semibold text-lg shadow-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Creating Account...
              </div>
            ) : (
              'Create Account'
            )}
          </button>

          {/* Error Display */}
          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Sign In Link */}
          <div className="text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={showSignIn}
                className="text-green-800 font-medium hover:underline"
              >
                Sign In
              </button>
            </p>
          </div>
        </form>
        
        {/* Security Message */}
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <i className="fas fa-lock text-green-800"></i>
            <span className="font-medium text-green-800">Your Data is Protected</span>
          </div>
          <p className="text-sm text-gray-600">
            We use bank-level encryption to protect your information. All data is stored securely and complies with POPIA regulations for tenant screening services.
          </p>
        </div>
      </div>
    </div>
  )
}

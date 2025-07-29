'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function OwnerRegistrationPage() {
  const router = useRouter()
  const { signUpOwner, isLoading, error } = useAuthStore()
  const [formData, setFormData] = useState({
    fullName: '',
    idNumber: '',
    email: '',
    phone: '',
    password: '',
    portfolioSize: '',
  })
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [showPassword, setShowPassword] = useState(false)
  const [ficaConsent, setFicaConsent] = useState(false)
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
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
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
      newErrors.fullName = 'Please enter your name or company name'
    }

    if (!formData.idNumber.trim()) {
      newErrors.idNumber = 'Please enter a valid ID or registration number'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Please enter a valid email address'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Please enter a valid SA phone number'
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password must be at least 8 characters'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (!formData.portfolioSize) {
      newErrors.portfolioSize = 'Please select your portfolio size'
    }

    if (!uploadedFile) {
      newErrors.idUpload = 'Please upload your document'
    }

    if (!ficaConsent) {
      newErrors.ficaConsent = 'Please provide FICA compliance consent'
    }

    if (!termsConsent) {
      newErrors.termsConsent = 'Please accept the terms and privacy policy'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    if (!uploadedFile) {
      setErrors(prev => ({ ...prev, idUpload: 'Please upload your document' }))
      return
    }

    try {
      const result = await signUpOwner({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        idNumber: formData.idNumber,
        phone: formData.phone,
        portfolioSize: formData.portfolioSize,
        ficaDocuments: uploadedFile
      })
      
      if (result.success) {
        router.push('/dashboard/owner')
      }
    } catch (error) {
      console.error('Registration failed:', error)
      setErrors(prev => ({ ...prev, submit: 'Registration failed. Please try again.' }))
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
      {/* Background Pattern - matching HTML design */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-12 w-16 h-16 border border-blue-600 rounded-full"></div>
        <div className="absolute bottom-40 right-8 w-20 h-20 border border-yellow-500 rounded-full"></div>
        <div className="absolute top-1/3 right-6 w-12 h-12 border border-green-600 rounded-full"></div>
      </div>
      
      {/* Header - matching HTML design */}
      <div className="bg-white shadow-sm p-4 relative z-10">
        <div className="flex items-center justify-between">
          <button 
            onClick={goBack}
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <i className="fas fa-arrow-left text-gray-600"></i>
          </button>
          <h1 className="text-lg font-bold text-gray-800">Create Owner Account</h1>
          <div className="w-10 h-10"></div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="p-6 relative z-10">
        {/* Welcome Message - matching HTML design */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-building text-white text-2xl"></i>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Join as Property Owner</h2>
          <p className="text-gray-600">Create your account to start listing and managing your properties</p>
        </div>
        
        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name / Company Name *
            </label>
            <input 
              type="text" 
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-gray-300" 
              placeholder="Enter your name or company name"
            />
            {errors.fullName && (
              <div className="text-red-500 text-sm mt-1 hidden" style={{display: errors.fullName ? 'block' : 'none'}}>{errors.fullName}</div>
            )}
          </div>
          
          {/* ID/Registration Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ID Number / Company Registration *
            </label>
            <input 
              type="text" 
              name="idNumber"
              value={formData.idNumber}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-gray-300" 
              placeholder="SA ID or Company Registration Number"
            />
            {errors.idNumber && (
              <div className="text-red-500 text-sm mt-1 hidden" style={{display: errors.idNumber ? 'block' : 'none'}}>{errors.idNumber}</div>
            )}
            <div className="text-gray-500 text-xs mt-1">
              For individuals: SA ID Number. For companies: Registration number
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
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-gray-300" 
              placeholder="your.email@example.com"
            />
            {errors.email && (
              <div className="text-red-500 text-sm mt-1 hidden" style={{display: errors.email ? 'block' : 'none'}}>{errors.email}</div>
            )}
          </div>
          
          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <div className="flex">
              <div className="flex items-center px-3 py-3 bg-gray-50 border border-r-0 border-gray-200 rounded-l-lg">
                <span className="text-gray-600 text-sm">🇿🇦 +27</span>
              </div>
              <input 
                type="tel" 
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-gray-300" 
                placeholder="81 234 5678"
              />
            </div>
            {errors.phone && (
              <div className="text-red-500 text-sm mt-1 hidden" style={{display: errors.phone ? 'block' : 'none'}}>{errors.phone}</div>
            )}
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
                className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-gray-300" 
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
              <div className="text-red-500 text-sm mt-1 hidden" style={{display: errors.password ? 'block' : 'none'}}>{errors.password}</div>
            )}
            <div className="text-gray-500 text-xs mt-1">
              Minimum 8 characters with letters and numbers
            </div>
          </div>

         {/* Property Portfolio Size */}
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Property Portfolio Size *
            </label>
            <select
                name="portfolioSize"
                value={formData.portfolioSize}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-gray-900"
                style={{ color: formData.portfolioSize === '' ? '#6b7280' : '#111827' }}
            >
                <option value="" disabled className="text-gray-600">
                Select portfolio size
                </option>
                <option value="1">1 Property</option>
                <option value="2-5">2-5 Properties</option>
                <option value="6-10">6-10 Properties</option>
                <option value="11-25">11-25 Properties</option>
                <option value="25+">25+ Properties</option>
            </select>
            {errors.portfolioSize && (
                <div className="text-red-500 text-sm mt-1 hidden" style={{display: errors.portfolioSize ? 'block' : 'none'}}>{errors.portfolioSize}</div>
            )}
            </div>


          {/* Document Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ID/Registration Document Upload *
            </label>
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-600 transition-colors cursor-pointer"
              onClick={() => document.getElementById('ownerIdUpload')?.click()}
            >
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-camera text-blue-800 text-xl"></i>
              </div>
              <p className="text-gray-700 font-medium mb-1">
                {uploadedFile ? uploadedFile.name : 'Upload ID or Registration Document'}
              </p>
              <p className="text-gray-500 text-sm">Clear image of your ID or company registration</p>
              <input 
                type="file" 
                id="ownerIdUpload" 
                accept="image/*,.pdf" 
                className="hidden" 
                onChange={handleFileUpload}
              />
            </div>
            {errors.idUpload && (
              <div className="text-red-500 text-sm mt-1 hidden" style={{display: errors.idUpload ? 'block' : 'none'}}>{errors.idUpload}</div>
            )}
            <div className="flex items-center mt-2 text-xs text-gray-500">
              <i className="fas fa-shield-alt text-blue-800 mr-2"></i>
              <span>Your documents are encrypted and securely stored</span>
            </div>
          </div>

          {/* FICA Compliance */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <input 
                type="checkbox" 
                id="ficaConsent" 
                checked={ficaConsent}
                onChange={(e) => setFicaConsent(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-800 border-gray-300 rounded focus:ring-blue-800"
              />
              <div className="flex-1">
                <label htmlFor="ficaConsent" className="text-sm font-medium text-gray-700 cursor-pointer">
                  FICA Compliance Consent *
                </label>
                <p className="text-xs text-gray-600 mt-1">
                  I consent to FICA verification processes required for property management services. This includes identity verification and compliance with South African financial regulations.
                </p>
              </div>
            </div>
            {errors.ficaConsent && (
              <div className="text-red-500 text-sm mt-1 hidden" style={{display: errors.ficaConsent ? 'block' : 'none'}}>{errors.ficaConsent}</div>
            )}
          </div>

          {/* Terms and Privacy */}
          <div className="flex items-start space-x-3">
            <input 
              type="checkbox" 
              id="ownerTermsConsent" 
              checked={termsConsent}
              onChange={(e) => setTermsConsent(e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-800 border-gray-300 rounded focus:ring-blue-800"
            />
            <div className="flex-1">
              <label htmlFor="ownerTermsConsent" className="text-sm text-gray-700 cursor-pointer">
                I agree to the <a href="#" className="text-blue-800 hover:underline">Terms of Service</a> and <a href="#" className="text-blue-800 hover:underline">Privacy Policy</a> *
              </label>
            </div>
          </div>
          {errors.termsConsent && (
            <div className="text-red-500 text-sm mt-1 hidden" style={{display: errors.termsConsent ? 'block' : 'none'}}>{errors.termsConsent}</div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-800 text-white py-4 rounded-lg font-semibold text-lg shadow-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Creating Account...
              </div>
            ) : (
              'Create Owner Account'
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
                className="text-blue-600 font-medium hover:underline"
              >
                Sign In
              </button>
            </p>
          </div>
        </form>
        
        {/* Security Message */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <i className="fas fa-lock text-blue-600"></i>
            <span className="font-medium text-blue-600">Your Data is Protected</span>
          </div>
          <p className="text-sm text-gray-600">
            We use bank-level encryption to protect your information. All data is stored securely and complies with POPIA and FICA regulations for property management services.
          </p>
        </div>
      </div>
    </div>
  )
}

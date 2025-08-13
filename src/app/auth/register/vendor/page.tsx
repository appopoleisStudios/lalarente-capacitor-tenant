'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { validateIdDocumentFile, formatFileSize } from '@/utils/fileValidation'
import { validateSAIDNumber, validateSAPhoneNumber } from '@/utils/saValidation'
import { validatePasswordStrength } from '@/utils/password'

export default function VendorRegistrationPage() {
  const router = useRouter()
  const { signUp, isLoading, error } = useAuthStore()
  const [formData, setFormData] = useState({
    fullName: '',
    idNumber: '',
    email: '',
    phone: '',
    password: ''
  })
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [showPassword, setShowPassword] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))

    if (name === 'idNumber' && value.trim()) {
      const validation = validateSAIDNumber(value)
      if (!validation.isValid) setErrors(prev => ({ ...prev, idNumber: validation.error || 'Invalid SA ID number' }))
    }
    if (name === 'phone' && value.trim()) {
      const validation = validateSAPhoneNumber(value)
      if (!validation.isValid) setErrors(prev => ({ ...prev, phone: validation.error || 'Invalid SA phone number' }))
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const validation = validateIdDocumentFile(file)
    if (!validation.isValid) {
      setErrors(prev => ({ ...prev, idUpload: validation.error || 'Invalid file' }))
      e.target.value = ''
      setUploadedFile(null)
      return
    }
    setUploadedFile(file)
    if (errors.idUpload) setErrors(prev => ({ ...prev, idUpload: '' }))
  }

  const validateForm = () => {
    const newErrors: Record<string,string> = {}
    if (!formData.fullName.trim()) newErrors.fullName = 'Please enter your full name or business name'
    if (!formData.idNumber.trim()) {
      newErrors.idNumber = 'Please enter a valid SA ID number'
    } else {
      const idValidation = validateSAIDNumber(formData.idNumber)
      if (!idValidation.isValid) newErrors.idNumber = idValidation.error || 'Invalid SA ID number'
    }
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email address'
    if (!formData.phone.trim()) {
      newErrors.phone = 'Please enter a valid SA phone number'
    } else {
      const phoneValidation = validateSAPhoneNumber(formData.phone)
      if (!phoneValidation.isValid) newErrors.phone = phoneValidation.error || 'Invalid SA phone number'
    }
    if (!formData.password.trim()) {
      newErrors.password = 'Password must be at least 8 characters'
    } else {
      const pw = validatePasswordStrength(formData.password)
      if (!pw.isValid) newErrors.password = pw.message || 'Weak password'
    }
    if (!uploadedFile) newErrors.idUpload = 'Please upload your ID document'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    try {
      const result = await signUp(formData.email, formData.password, formData.fullName, 'vendor')
      if (result.success) {
        router.push('/dashboard/vendor')
      } else {
        setErrors(prev => ({ ...prev, submit: 'Registration failed. Please try again.' }))
      }
    } catch {
      setErrors(prev => ({ ...prev, submit: 'Registration failed. Please try again.' }))
    }
  }

  const goBack = () => router.push('/onboarding/user-type')
  const showSignIn = () => router.push('/auth/login')

  return (
    <div className="max-w-md mx-auto min-h-screen shadow-xl bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-12 w-16 h-16 border border-blue-600 rounded-full"></div>
        <div className="absolute bottom-40 right-8 w-20 h-20 border border-yellow-500 rounded-full"></div>
        <div className="absolute top-1/3 right-6 w-12 h-12 border border-green-600 rounded-full"></div>
      </div>
      <div className="bg-white shadow-sm p-4 relative z-10">
        <div className="flex items-center justify-between">
          <button onClick={goBack} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
            <i className="fas fa-arrow-left text-gray-600"></i>
          </button>
          <h1 className="text-lg font-bold text-gray-800">Create Vendor Account</h1>
          <div className="w-10 h-10"></div>
        </div>
      </div>

      <div className="p-6 relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-tools text-white text-2xl"></i>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Join as Service Vendor</h2>
          <p className="text-gray-600">Create your vendor account to offer services to property managers and tenants</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name / Business Name *</label>
            <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-gray-300 text-gray-900" placeholder="Enter your name or business name" />
            {errors.fullName && <div className="text-red-500 text-sm mt-1" style={{display: errors.fullName ? 'block':'none'}}>{errors.fullName}</div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">South African ID Number *</label>
            <input type="text" name="idNumber" value={formData.idNumber} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-gray-300 text-gray-900" placeholder="YYMMDD 0000 000 0 0" maxLength={19} />
            {errors.idNumber && <div className="text-red-500 text-sm mt-1" style={{display: errors.idNumber ? 'block':'none'}}>{errors.idNumber}</div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
            <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-gray-300 text-gray-900" placeholder="your.email@example.com" />
            {errors.email && <div className="text-red-500 text-sm mt-1" style={{display: errors.email ? 'block':'none'}}>{errors.email}</div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
            <div className="flex">
              <div className="flex items-center px-3 py-3 bg-gray-50 border border-r-0 border-gray-200 rounded-l-lg"><span className="text-gray-600 text-sm">🇿🇦 +27</span></div>
              <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="flex-1 px-4 py-3 border border-gray-200 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-gray-300 text-gray-900" placeholder="81 234 5678" />
            </div>
            {errors.phone && <div className="text-red-500 text-sm mt-1" style={{display: errors.phone ? 'block':'none'}}>{errors.phone}</div>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleInputChange} className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent placeholder-gray-300 text-gray-900" placeholder="Create a strong password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
            </div>
            {errors.password && <div className="text-red-500 text-sm mt-1" style={{display: errors.password ? 'block':'none'}}>{errors.password}</div>}
            <div className="text-gray-500 text-xs mt-1">Minimum 8 characters with upper/lower, number, symbol</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ID Document Upload *</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-600 transition-colors cursor-pointer" onClick={() => document.getElementById('vendorIdUpload')?.click()}>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3"><i className="fas fa-camera text-blue-800 text-xl"></i></div>
              <p className="text-gray-700 font-medium mb-1">{uploadedFile ? uploadedFile.name : 'Upload SA ID Document'}</p>
              <p className="text-gray-500 text-sm">{uploadedFile ? `File size: ${formatFileSize(uploadedFile.size)}` : 'Take a photo or upload a clear image of your ID (Max 5MB)'}
              </p>
              <input type="file" id="vendorIdUpload" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
            </div>
            {errors.idUpload && <div className="text-red-500 text-sm mt-1" style={{display: errors.idUpload ? 'block':'none'}}>{errors.idUpload}</div>}
          </div>

          <button type="submit" disabled={isLoading} className="w-full bg-blue-800 text-white py-4 rounded-lg font-semibold text-lg shadow-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isLoading ? (<div className="flex items-center justify-center"><i className="fas fa-spinner fa-spin mr-2"></i>Creating Account...</div>) : 'Create Account'}
          </button>

          {error && <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg">{error}</div>}
          {errors.submit && <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg">{errors.submit}</div>}

          <div className="text-center">
            <p className="text-gray-600">Already have an account?{' '}
              <button type="button" onClick={showSignIn} className="text-blue-600 font-medium hover:underline">Sign In</button>
            </p>
          </div>
        </form>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2"><i className="fas fa-lock text-blue-600"></i><span className="font-medium text-blue-600">Your Data is Protected</span></div>
          <p className="text-sm text-gray-600">We use bank-level encryption. POPIA and compliance standards apply.</p>
        </div>
      </div>
    </div>
  )
}



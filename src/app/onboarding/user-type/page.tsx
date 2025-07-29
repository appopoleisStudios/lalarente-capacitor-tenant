'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { UserRole } from '@/lib/supabase'

export default function UserTypeSelection() {
  const router = useRouter()

  const selectUserType = (userType: UserRole) => {
    if (userType === 'tenant') {
      router.push('/auth/register?type=tenant')
    } else if (userType === 'owner') {
      router.push('/auth/register/owner')  // ✅ Updated to navigate to dedicated owner page
    }
  }

  // ... rest of your component code remains the same
  return (
    <div className="max-w-md mx-auto min-h-screen shadow-xl bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-12 w-16 h-16 border border-green-600 rounded-full"></div>
        <div className="absolute bottom-40 right-8 w-20 h-20 border border-blue-600 rounded-full"></div>
        <div className="absolute top-1/3 right-6 w-12 h-12 border border-yellow-500 rounded-full"></div>
      </div>
      
      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-home text-white text-2xl"></i>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-3">Choose Your Experience</h1>
          <p className="text-gray-600 text-lg leading-relaxed px-4">
            Select your role to access the features designed specifically for you
          </p>
        </div>
        
        {/* User Type Cards */}
        <div className="w-full max-w-sm space-y-4 mb-8">
          {/* Tenant Card */}
          <div 
            className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-green-600 transition-all duration-300 cursor-pointer group"
            onClick={() => selectUserType('tenant')}
          >
            <div className="p-6">
              {/* Icon and Illustration */}
              <div className="flex items-center justify-center mb-4">
                <div className="relative">
                  {/* House with Key */}
                  <div className="w-20 h-16 bg-gradient-to-t from-green-600 to-green-400 rounded-lg relative">
                    {/* House roof */}
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-b-[8px] border-l-transparent border-r-transparent border-b-green-600"></div>
                    {/* Door */}
                    <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-8 bg-amber-600 rounded-t-sm"></div>
                    {/* Windows */}
                    <div className="absolute top-2 left-2 w-3 h-3 bg-yellow-200 rounded-sm"></div>
                    <div className="absolute top-2 right-2 w-3 h-3 bg-yellow-200 rounded-sm"></div>
                  </div>
                  {/* Key */}
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                    <i className="fas fa-key text-white text-sm"></i>
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-800 mb-2">I&apos;m a Tenant</h3>
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                  Find your perfect rental, pay rent securely, request maintenance, and communicate with your property manager
                </p>
                
                {/* Features List */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <i className="fas fa-check text-green-600 text-xs mr-2"></i>
                    <span>Browse verified properties</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <i className="fas fa-check text-green-600 text-xs mr-2"></i>
                    <span>Secure online rent payments</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <i className="fas fa-check text-green-600 text-xs mr-2"></i>
                    <span>Easy maintenance requests</span>
                  </div>
                </div>
                
                {/* Selection Button */}
                <Button className="w-full bg-green-600 text-white py-3 rounded-lg font-medium group-hover:bg-green-700 transition-colors">
                  Continue as Tenant
                </Button>
              </div>
            </div>
          </div>
          
          {/* Property Owner Card */}
          <div 
            className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-blue-600 transition-all duration-300 cursor-pointer group"
            onClick={() => selectUserType('owner')}
          >
            <div className="p-6">
              {/* Icon and Illustration */}
              <div className="flex items-center justify-center mb-4">
                <div className="relative">
                  {/* Building */}
                  <div className="w-20 h-20 bg-gradient-to-t from-blue-600 to-blue-400 rounded-lg relative">
                    {/* Building Windows Grid */}
                    <div className="absolute inset-2 grid grid-cols-3 gap-1">
                      <div className="bg-yellow-200 rounded-sm"></div>
                      <div className="bg-white rounded-sm"></div>
                      <div className="bg-yellow-200 rounded-sm"></div>
                      <div className="bg-white rounded-sm"></div>
                      <div className="bg-yellow-200 rounded-sm"></div>
                      <div className="bg-white rounded-sm"></div>
                      <div className="bg-yellow-200 rounded-sm"></div>
                      <div className="bg-white rounded-sm"></div>
                      <div className="bg-yellow-200 rounded-sm"></div>
                    </div>
                    {/* Building Entrance */}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-6 h-8 bg-gray-700 rounded-t-sm"></div>
                  </div>
                  {/* Management Icon */}
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                    <i className="fas fa-chart-line text-white text-sm"></i>
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-800 mb-2">I&apos;m a Property Owner</h3>
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                  List your properties, manage tenants, track payments, and oversee maintenance requests efficiently
                </p>
                
                {/* Features List */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <i className="fas fa-check text-blue-600 text-xs mr-2"></i>
                    <span>List & manage properties</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <i className="fas fa-check text-blue-600 text-xs mr-2"></i>
                    <span>Track rental income</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <i className="fas fa-check text-blue-600 text-xs mr-2"></i>
                    <span>Tenant communication hub</span>
                  </div>
                </div>
                
                {/* Selection Button */}
                <Button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium group-hover:bg-blue-700 transition-colors">
                  Continue as Owner
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Learn More Link */}
        <div className="text-center">
          <button className="text-gray-500 text-sm hover:text-green-600 transition-colors">
            Not sure? Learn more about each option
          </button>
        </div>
        
        {/* Page Indicator Dots */}
        <div className="flex space-x-2 mt-8">
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-green-600 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute top-16 right-12 w-4 h-4 bg-green-600 rounded-full opacity-60"></div>
      <div className="absolute top-40 left-8 w-3 h-3 bg-blue-600 rounded-full opacity-40"></div>
      <div className="absolute bottom-40 right-20 w-5 h-5 bg-yellow-500 rounded-full opacity-50"></div>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function PaymentsPage() {
  const router = useRouter()

  const continueTo = () => {
    router.push('/onboarding/maintenance')
  }

  return (
    <div className="max-w-md mx-auto min-h-screen shadow-xl bg-gradient-to-b from-blue-50 to-green-50 relative overflow-hidden">
      {/* Background Security Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-12 w-16 h-16 border-2 border-blue-500 rounded-full"></div>
        <div className="absolute bottom-60 right-8 w-20 h-20 border-2 border-green-500 rounded-full"></div>
        <div className="absolute top-1/2 left-6 w-12 h-12 border-2 border-blue-400 rounded-full"></div>
        <div className="absolute top-32 right-16 w-8 h-8 bg-green-400 rounded-full"></div>
      </div>
      
      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-3">Pay Rent Safely & Easily</h1>
          <p className="text-gray-600 text-lg leading-relaxed px-4">
            Secure payments, automated reminders, and instant receipts. All your payment history in one place
          </p>
        </div>
        
        {/* Security Shield Icon */}
        <div className="mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center shadow-lg mb-4">
            <i className="fas fa-shield-alt text-white text-3xl"></i>
          </div>
        </div>
        
        {/* Payment Methods Display */}
        <div className="w-full max-w-sm mb-8">
          {/* Credit Card Mockup */}
          <div className="relative mb-6">
            <div className="w-full h-32 bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-lg relative overflow-hidden">
              {/* Card Pattern */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-4 left-4 w-8 h-8 border border-white rounded-full"></div>
                <div className="absolute top-4 right-4 w-6 h-6 border border-white rounded-full"></div>
                <div className="absolute bottom-4 left-4 w-4 h-4 bg-white rounded-full"></div>
              </div>
              
              {/* Card Content */}
              <div className="absolute inset-0 p-4 flex flex-col justify-between text-white">
                <div className="flex justify-between items-start">
                  <div className="text-xs font-medium">SECURE PAYMENT</div>
                  <i className="fas fa-credit-card text-lg"></i>
                </div>
                <div>
                  <div className="text-lg font-bold tracking-wider mb-1">•••• •••• •••• 4532</div>
                  <div className="flex justify-between text-xs">
                    <span>THABO MTHEMBU</span>
                    <span>12/26</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Payment Gateway Logos */}
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 mb-6">
            <p className="text-center text-sm text-gray-600 mb-3">Trusted Payment Partners</p>
            <div className="grid grid-cols-2 gap-4">
              {/* PayFast Logo Representation */}
              <div className="flex items-center justify-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-center">
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mb-1">
                    <i className="fas fa-bolt text-white text-sm"></i>
                  </div>
                  <span className="text-xs font-bold text-orange-600">PayFast</span>
                </div>
              </div>
              
              {/* SnapScan Logo Representation */}
              <div className="flex items-center justify-center p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="text-center">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mb-1">
                    <i className="fas fa-qrcode text-white text-sm"></i>
                  </div>
                  <span className="text-xs font-bold text-green-600">SnapScan</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* ZAR Currency Display */}
          <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <span className="text-2xl font-bold text-green-600">R</span>
              <span className="text-lg text-gray-700">South African Rand</span>
            </div>
            <p className="text-sm text-gray-600">All payments in ZAR currency</p>
          </div>
        </div>
        
        {/* Security Features */}
        <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-sm">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
              <i className="fas fa-lock text-blue-600 text-lg"></i>
            </div>
            <span className="text-xs text-gray-600 text-center">Bank-Level Security</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
              <i className="fas fa-receipt text-green-600 text-lg"></i>
            </div>
            <span className="text-xs text-gray-600 text-center">Instant Receipts</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
              <i className="fas fa-bell text-blue-600 text-lg"></i>
            </div>
            <span className="text-xs text-gray-600 text-center">Auto Reminders</span>
          </div>
        </div>
        
        {/* Continue Button */}
        <Button 
          onClick={continueTo}
          className="bg-gradient-to-r from-blue-600 to-green-600 text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-lg hover:from-blue-700 hover:to-green-700 transition-all mb-8"
        >
          Continue
        </Button>
        
        {/* Page Indicator Dots */}
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
        </div>
      </div>
      
      {/* Decorative Security Elements */}
      <div className="absolute top-16 right-12 w-6 h-6 bg-blue-400 rounded-full opacity-60"></div>
      <div className="absolute top-40 left-8 w-4 h-4 bg-green-400 rounded-full opacity-50"></div>
      <div className="absolute bottom-40 right-20 w-5 h-5 bg-blue-500 rounded-full opacity-40"></div>
      <div className="absolute bottom-60 left-16 w-3 h-3 bg-green-500 rounded-full opacity-60"></div>
    </div>
  )
}

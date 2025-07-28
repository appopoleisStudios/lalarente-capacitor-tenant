'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function PaymentsPage() {
  const router = useRouter()

  const continueTo = () => {
    router.push('/onboarding/maintenance')
  }

  return (
    <div className="max-w-md mx-auto min-h-screen shadow-xl bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Pay Rent Safely & Easily
          </h1>
          <p className="text-gray-600 text-lg leading-relaxed px-4 mb-8">
            Secure payments, automated reminders, and instant receipts. All your payment history in one place
          </p>
        </div>

        {/* Security Shield */}
        <div className="w-24 h-24 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center mb-8 shadow-lg">
          <i className="fas fa-shield-alt text-white text-3xl"></i>
        </div>

        {/* Payment Card Mockup */}
        <div className="w-80 bg-gradient-to-r from-sa-blue-500 to-sa-blue-600 rounded-2xl p-6 mb-8 shadow-xl text-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm opacity-90">SECURE PAYMENT</span>
            <i className="fas fa-credit-card text-xl"></i>
          </div>
          <div className="text-lg font-mono mb-2">•••• •••• •••• 4532</div>
          <div className="flex justify-between items-center">
            <span className="text-sm">THABO MTHEMBU</span>
            <span className="text-sm">12/26</span>
          </div>
        </div>

        {/* Payment Partners */}
        <div className="text-center mb-8">
          <p className="text-sm text-gray-600 mb-4">Trusted Payment Partners</p>
          <div className="flex justify-center space-x-6">
            <div className="w-16 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-orange-600 font-bold text-xs">PayFast</span>
            </div>
            <div className="w-16 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-green-600 font-bold text-xs">SnapScan</span>
            </div>
          </div>
        </div>

        {/* ZAR Currency */}
        <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-xl p-4 mb-8 w-full max-w-sm">
          <div className="flex items-center justify-center space-x-3">
            <div className="w-8 h-8 bg-sa-green-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <div>
              <p className="font-semibold text-gray-800">South African Rand</p>
              <p className="text-sm text-gray-600">All payments in ZAR currency</p>
            </div>
          </div>
        </div>

        {/* Security Features */}
        <div className="flex justify-center space-x-8 mb-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
              <i className="fas fa-lock text-blue-600"></i>
            </div>
            <span className="text-xs text-gray-600">Bank-Level Security</span>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
              <i className="fas fa-receipt text-green-600"></i>
            </div>
            <span className="text-xs text-gray-600">Instant Receipts</span>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-sa-blue-100 rounded-full flex items-center justify-center mb-2">
              <i className="fas fa-bell text-sa-blue-600"></i>
            </div>
            <span className="text-xs text-gray-600">Auto Reminders</span>
          </div>
        </div>

        <Button 
          onClick={continueTo}
          className="bg-sa-blue-500 text-white px-8 py-3 rounded-lg font-semibold shadow-lg hover:bg-blue-700 transition-colors mb-4"
        >
          Continue
        </Button>

        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-sa-blue-500 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
        </div>
      </div>
    </div>
  )
}

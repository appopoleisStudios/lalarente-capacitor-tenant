'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function MaintenancePage() {
  const router = useRouter()

  const continueTo = () => {
    router.push('/onboarding/user-type')
  }

  return (
    <div className="max-w-md mx-auto min-h-screen shadow-xl bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Report & Track Maintenance
          </h1>
          <p className="text-gray-600 text-lg leading-relaxed px-4 mb-8">
            Photo-enabled requests, real-time updates, and choose between in-house team or competitive vendor quotes
          </p>
        </div>

        {/* Service Options */}
        <div className="grid grid-cols-2 gap-4 mb-8 w-full max-w-sm">
          <div className="bg-blue-100 rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-3">
              <i className="fas fa-camera text-white text-xl"></i>
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">📱 Photo</h3>
            <p className="text-xs text-gray-600">Visual documentation for faster resolution</p>
          </div>
          
          <div className="bg-green-100 rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-green-600 rounded-lg flex items-center justify-center mx-auto mb-3">
              <i className="fas fa-tools text-white text-xl"></i>
            </div>
            <h3 className="font-semibold text-gray-800 mb-1">🔧 Fix</h3>
            <p className="text-xs text-gray-600">Quick repair solutions</p>
          </div>
        </div>

        {/* Service Option Selection */}
        <div className="bg-white rounded-xl p-6 mb-8 w-full max-w-sm shadow-lg border">
          <h3 className="text-center font-semibold text-gray-800 mb-4">Choose Your Service Option</h3>
          
          <div className="space-y-3">
            <div className="bg-sa-green-500 text-white rounded-lg p-4 text-center">
              <span className="font-medium">In-House Team</span>
            </div>
            
            <div className="border border-gray-300 rounded-lg p-4 text-center">
              <span className="text-gray-700">Vendor Quotes</span>
            </div>
          </div>
        </div>

        {/* Feature List */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-2 mx-auto">
              <i className="fas fa-camera text-orange-600"></i>
            </div>
            <h4 className="font-semibold text-gray-800 text-sm">Photo Reports</h4>
            <p className="text-xs text-gray-600">Visual documentation for faster resolution</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2 mx-auto">
              <i className="fas fa-clock text-blue-600"></i>
            </div>
            <h4 className="font-semibold text-gray-800 text-sm">Real-Time Updates</h4>
            <p className="text-xs text-gray-600">Track progress from request to completion</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2 mx-auto">
              <i className="fas fa-users text-green-600"></i>
            </div>
            <h4 className="font-semibold text-gray-800 text-sm">In-House Team</h4>
            <p className="text-xs text-gray-600">Trusted property maintenance specialists</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-2 mx-auto">
              <i className="fas fa-quote-right text-purple-600"></i>
            </div>
            <h4 className="font-semibold text-gray-800 text-sm">Vendor Quotes</h4>
            <p className="text-xs text-gray-600">Compare competitive prices and services</p>
          </div>
        </div>

        <Button 
          onClick={continueTo}
          className="bg-sa-green-500 text-white px-8 py-3 rounded-lg font-semibold shadow-lg hover:bg-green-700 transition-colors mb-4"
        >
          Continue
        </Button>

        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-sa-green-500 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
        </div>
      </div>
    </div>
  )
}

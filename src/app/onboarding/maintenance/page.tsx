'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function MaintenancePage() {
  const router = useRouter()

  const continueTo = () => {
    router.push('/onboarding/user-type')
  }

  return (
    <div className="max-w-md mx-auto min-h-screen shadow-xl bg-gradient-to-b from-green-50 to-blue-50 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-16 left-8 w-20 h-20 border border-green-600 rounded-full"></div>
        <div className="absolute bottom-40 right-12 w-16 h-16 border border-blue-500 rounded-full"></div>
        <div className="absolute top-1/3 right-6 w-12 h-12 border border-green-400 rounded-full"></div>
      </div>

      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-3">
            Report & Track Maintenance
          </h1>
          <p className="text-gray-600 text-lg leading-relaxed px-4">
            Photo-enabled requests, real-time updates, and choose between in-house team or competitive vendor quotes
          </p>
        </div>

        {/* Phone Mockup */}
        <div className="relative mb-8">
          {/* Phone Frame */}
          <div className="w-64 h-96 bg-gray-800 rounded-3xl p-2 shadow-2xl">
            <div className="w-full h-full bg-white rounded-2xl overflow-hidden relative">
              {/* Phone Header */}
              <div className="bg-green-600 text-white p-3 text-center">
                <h2 className="text-sm font-semibold">Maintenance Center</h2>
                <p className="text-xs opacity-90">Report & track your requests</p>
              </div>
              
              {/* Maintenance Content */}
              <div className="p-4 space-y-4">
                {/* Active Requests Section */}
                <div className="bg-orange-50 rounded-lg p-3">
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">Active Requests</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs font-semibold">Kitchen Tap Repair</p>
                        <p className="text-xs text-gray-500">In Progress</p>
                      </div>
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs font-semibold">Electrical Issue</p>
                        <p className="text-xs text-gray-500">Scheduled</p>
                      </div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    </div>
                  </div>
                </div>

                {/* Service Options */}
                <div className="bg-blue-50 rounded-lg p-3">
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">Choose Your Service Option</h3>
                  <div className="space-y-2">
                    <div className="bg-green-600 text-white rounded text-center py-2">
                      <span className="text-xs font-medium">In-House Team</span>
                    </div>
                    <div className="border border-gray-300 rounded text-center py-2">
                      <span className="text-xs text-gray-700">Vendor Quotes</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-100 rounded-lg p-3 text-center">
                    <div className="w-8 h-8 bg-blue-600 rounded mx-auto mb-1 flex items-center justify-center">
                      <i className="fas fa-camera text-white text-xs"></i>
                    </div>
                    <p className="text-xs font-semibold">📱 Photo</p>
                  </div>
                  <div className="bg-green-100 rounded-lg p-3 text-center">
                    <div className="w-8 h-8 bg-green-600 rounded mx-auto mb-1 flex items-center justify-center">
                      <i className="fas fa-tools text-white text-xs"></i>
                    </div>
                    <p className="text-xs font-semibold">🔧 Fix</p>
                  </div>
                </div>
              </div>
              
              {/* Bottom Navigation */}
              <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2">
                <div className="flex justify-around">
                  <i className="fas fa-home text-gray-400 text-sm"></i>
                  <i className="fas fa-credit-card text-gray-400 text-sm"></i>
                  <i className="fas fa-tools text-green-600 text-sm"></i>
                  <i className="fas fa-user text-gray-400 text-sm"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Icons */}
        <div className="grid grid-cols-2 gap-6 mb-8 w-full max-w-sm">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-2">
              <i className="fas fa-camera text-orange-600 text-lg"></i>
            </div>
            <h4 className="font-semibold text-gray-800 text-sm">Photo Reports</h4>
            <p className="text-xs text-gray-600 text-center">Visual documentation for faster resolution</p>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
              <i className="fas fa-clock text-blue-600 text-lg"></i>
            </div>
            <h4 className="font-semibold text-gray-800 text-sm">Real-Time Updates</h4>
            <p className="text-xs text-gray-600 text-center">Track progress from request to completion</p>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
              <i className="fas fa-users text-green-600 text-lg"></i>
            </div>
            <h4 className="font-semibold text-gray-800 text-sm">In-House Team</h4>
            <p className="text-xs text-gray-600 text-center">Trusted property maintenance specialists</p>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-2">
              <i className="fas fa-quote-right text-purple-600 text-lg"></i>
            </div>
            <h4 className="font-semibold text-gray-800 text-sm">Vendor Quotes</h4>
            <p className="text-xs text-gray-600 text-center">Compare competitive prices and services</p>
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
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-green-600 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute top-20 right-8 w-4 h-4 bg-green-500 rounded-full opacity-60"></div>
      <div className="absolute top-40 left-6 w-3 h-3 bg-blue-500 rounded-full opacity-40"></div>
      <div className="absolute bottom-40 right-16 w-5 h-5 bg-green-600 rounded-full opacity-50"></div>
    </div>
  )
}

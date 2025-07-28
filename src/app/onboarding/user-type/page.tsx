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
      router.push('/auth/register?type=owner')
    }
  }

  return (
    <div className="max-w-md mx-auto min-h-screen shadow-xl bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-10">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Choose Your Path</h1>
          <p className="text-gray-600 text-lg leading-relaxed px-4">
            Whether you're looking for a home or managing properties, we've got you covered.
          </p>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* For Tenants */}
          <div 
            className="bg-white rounded-2xl p-8 shadow-xl cursor-pointer hover:shadow-2xl transition-shadow"
            onClick={() => selectUserType('tenant')}
          >
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-sa-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-home text-white text-3xl"></i>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">For Tenants</h3>
              <p className="text-gray-600">Find your perfect home with ease</p>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-start space-x-3">
                <i className="fas fa-search text-sa-green-500 mt-1"></i>
                <div>
                  <h4 className="font-semibold text-gray-900">Browse Properties</h4>
                  <p className="text-gray-600 text-sm">Search verified listings with detailed photos and virtual tours</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <i className="fas fa-credit-card text-sa-green-500 mt-1"></i>
                <div>
                  <h4 className="font-semibold text-gray-900">Pay Rent Securely</h4>
                  <p className="text-gray-600 text-sm">Automated payments with instant confirmations</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <i className="fas fa-wrench text-sa-green-500 mt-1"></i>
                <div>
                  <h4 className="font-semibold text-gray-900">Request Maintenance</h4>
                  <p className="text-gray-600 text-sm">Report issues with photos and track progress</p>
                </div>
              </div>
            </div>
            
            <Button className="w-full bg-sa-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-800 transition-colors">
              Start House Hunting
            </Button>
          </div>
          
          {/* For Property Owners */}
          <div 
            className="bg-white rounded-2xl p-8 shadow-xl cursor-pointer hover:shadow-2xl transition-shadow"
            onClick={() => selectUserType('owner')}
          >
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-sa-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-building text-white text-3xl"></i>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">For Property Owners</h3>
              <p className="text-gray-600">Manage your properties with confidence</p>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-start space-x-3">
                <i className="fas fa-plus text-sa-blue-500 mt-1"></i>
                <div>
                  <h4 className="font-semibold text-gray-900">List Properties</h4>
                  <p className="text-gray-600 text-sm">Create attractive listings with professional photos</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <i className="fas fa-user-check text-sa-blue-500 mt-1"></i>
                <div>
                  <h4 className="font-semibold text-gray-900">Screen Tenants</h4>
                  <p className="text-gray-600 text-sm">Comprehensive background and credit checks</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <i className="fas fa-chart-line text-sa-blue-500 mt-1"></i>
                <div>
                  <h4 className="font-semibold text-gray-900">Track Income</h4>
                  <p className="text-gray-600 text-sm">Detailed financial reports and analytics</p>
                </div>
              </div>
            </div>
            
            <Button className="w-full bg-sa-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors">
              List Your Property
            </Button>
          </div>
        </div>

        <div className="flex space-x-2 mt-8">
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-sa-green-500 rounded-full"></div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import Image from 'next/image'

export default function DiscoverPage() {
  const router = useRouter()

  const continueTo = () => {
    router.push('/onboarding/payments')
  }

  // const goBack = () => {
  //   router.push('/')
  // }

  return (
    <div className="max-w-md mx-auto min-h-screen shadow-xl bg-gradient-to-b from-green-50 to-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-16 left-8 w-20 h-20 border border-green-600 rounded-full"></div>
        <div className="absolute bottom-40 right-12 w-16 h-16 border border-yellow-500 rounded-full"></div>
        <div className="absolute top-1/3 right-6 w-12 h-12 border border-blue-500 rounded-full"></div>
      </div>
      
      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-3">Discover Your Dream Property</h1>
          <p className="text-gray-600 text-lg leading-relaxed px-4">Browse thousands of verified listings with virtual tours, detailed photos, and neighborhood insights</p>
        </div>
        
        {/* Smartphone Mockup */}
        <div className="relative mb-8">
          {/* Phone Frame */}
          <div className="w-64 h-96 bg-gray-800 rounded-3xl p-2 shadow-2xl">
            <div className="w-full h-full bg-white rounded-2xl overflow-hidden relative">
              {/* Phone Header */}
              <div className="bg-green-800 text-white p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <i className="fas fa-search text-white"></i>
                  <span className="text-sm font-medium">Property Search</span>
                </div>
                <i className="fas fa-filter text-white"></i>
              </div>
              
              {/* Property Cards */}
              <div className="p-3 space-y-3 overflow-hidden">
                {/* Sandton Property */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="h-20 relative overflow-hidden">
                    {/* Sandton Apartment Image */}
                    <Image 
                      src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=300&h=200&fit=crop&crop=center" 
                      alt="Modern Sandton Apartment"
                      width={300}
                      height={200}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                      <i className="fas fa-heart text-red-500 text-xs"></i>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-green-800 text-white px-2 py-1 rounded text-xs">
                      Virtual Tour
                    </div>
                  </div>
                  <div className="p-2">
                    <h3 className="font-bold text-xs text-gray-800">Sandton Apartment</h3>
                    <p className="text-xs text-gray-600">📍 Sandton, Johannesburg</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-green-600 font-bold text-xs">R 15,000</span>
                      <div className="flex space-x-1 text-xs text-gray-500">
                        <span>🛏️2</span>
                        <span>🚿2</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Cape Town Property */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="h-20 relative overflow-hidden">
                    {/* Cape Town Townhouse Image */}
                    <Image 
                      src="https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=300&h=200&fit=crop&crop=center" 
                      alt="Cape Town Townhouse"
                      width={300}
                      height={200}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                      <i className="far fa-heart text-gray-400 text-xs"></i>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-blue-800 text-white px-2 py-1 rounded text-xs">
                      Photos: 12
                    </div>
                  </div>
                  <div className="p-2">
                    <h3 className="font-bold text-xs text-gray-800">Cape Town Townhouse</h3>
                    <p className="text-xs text-gray-600">📍 Sea Point, Cape Town</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-green-600 font-bold text-xs">R 18,500</span>
                      <div className="flex space-x-1 text-xs text-gray-500">
                        <span>🛏️3</span>
                        <span>🚿2</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Durban Property */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="h-20 relative overflow-hidden">
                    {/* Durban Beachfront Image */}
                    <Image 
                    src="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=300&h=200&fit=crop&crop=center" 
                    alt="Durban Beachfront Apartment"
                    width={300}
                    height={200}
                    className="w-full h-full object-cover"
                  />
                    <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                      <i className="far fa-heart text-gray-400 text-xs"></i>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs">
                      New Listing
                    </div>
                  </div>
                  <div className="p-2">
                    <h3 className="font-bold text-xs text-gray-800">Durban Beachfront</h3>
                    <p className="text-xs text-gray-600">📍 Umhlanga, Durban</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-green-600 font-bold text-xs">R 22,000</span>
                      <div className="flex space-x-1 text-xs text-gray-500">
                        <span>🛏️2</span>
                        <span>🚿1</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Bottom Navigation Preview */}
              <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2">
                <div className="flex justify-around">
                  <i className="fas fa-search text-green-600 text-sm"></i>
                  <i className="fas fa-filter text-gray-400 text-sm"></i>
                  <i className="fas fa-heart text-gray-400 text-sm"></i>
                  <i className="fas fa-map text-gray-400 text-sm"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Feature Icons */}
        <div className="grid grid-cols-4 gap-6 mb-8 w-full max-w-sm">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-green-800/10 rounded-full flex items-center justify-center mb-2">
              <i className="fas fa-search text-green-800 text-lg"></i>
            </div>
            <span className="text-xs text-gray-600 text-center">Smart Search</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-2">
              <i className="fas fa-filter text-blue-800 text-lg"></i>
            </div>
            <span className="text-xs text-gray-600 text-center">Advanced Filters</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center mb-2">
              <i className="fas fa-video text-yellow-500 text-lg"></i>
            </div>
            <span className="text-xs text-gray-600 text-center">Virtual Tours</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-2">
              <i className="fas fa-heart text-red-500 text-lg"></i>
            </div>
            <span className="text-xs text-gray-600 text-center">Save Favorites</span>
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
          <div className="w-3 h-3 bg-green-800 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
          <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute top-20 right-8 w-4 h-4 bg-yellow-500 rounded-full opacity-60"></div>
      <div className="absolute top-40 left-6 w-3 h-3 bg-blue-500 rounded-full opacity-40"></div>
      <div className="absolute bottom-40 right-16 w-5 h-5 bg-green-600 rounded-full opacity-50"></div>
    </div>
  )
}

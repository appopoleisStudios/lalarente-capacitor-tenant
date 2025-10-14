'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import BottomNavbar from '@/components/BottomNavbar'
import PropertyImageGallery from '@/components/PropertyImageGallery'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/supabase'
import { ArrowLeft } from 'lucide-react'

type Property = Database['public']['Tables']['properties']['Row']

export default function PropertyDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuthStore()
  
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lease, setLease] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)

  const propertyId = params.id as string

  useEffect(() => {
    if (!user || !propertyId) return

    const loadProperty = async () => {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .eq('id', propertyId)
          .eq('owner_id', user.id)
          .maybeSingle()

        if (error) throw error
        if (!data) {
          setError('Property not found')
          return
        }

        setProperty(data)

        // Load lease and tenant data if property is occupied
        if (data.status === 'occupied') {
          const { data: leaseData } = await supabase
            .from('leases')
            .select(`
              *,
              tenant:profiles!leases_tenant_id_fkey(full_name, email, phone)
            `)
            .eq('property_id', propertyId)
            .eq('status', 'active')
            .maybeSingle()

          if (leaseData) {
            setLease(leaseData)
            setTenant(leaseData.tenant)
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load property')
      } finally {
        setLoading(false)
      }
    }

    loadProperty()
  }, [user, propertyId])

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['owner']}>
        <div className="max-w-sm mx-auto min-h-screen bg-white pb-24">
          <div className="px-4 py-4 border-b flex items-center justify-between">
            <h1 className="font-semibold text-gray-900">Property Details</h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800 text-sm">Back</button>
          </div>
          <div className="px-4 py-8 text-center text-gray-500">Loading...</div>
        </div>
      </ProtectedRoute>
    )
  }

  if (error || !property) {
    return (
      <ProtectedRoute allowedRoles={['owner']}>
        <div className="max-w-sm mx-auto min-h-screen bg-white pb-24">
          <div className="px-4 py-4 border-b flex items-center justify-between">
            <h1 className="font-semibold text-gray-900">Property Details</h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800 text-sm">Back</button>
          </div>
          <div className="px-4 py-8 text-center">
            <div className="text-red-600 mb-4">{error || 'Property not found'}</div>
            <button 
              onClick={() => router.push('/dashboard/owner/properties')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              Back to Properties
            </button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800'
      case 'occupied': return 'bg-blue-100 text-blue-800'
      case 'maintenance': return 'bg-yellow-100 text-yellow-800'
      case 'unavailable': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div className="max-w-sm mx-auto min-h-screen bg-white pb-24">
        {/* Header */}
        <div className="px-4 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h1 className="font-semibold text-gray-900">Property Details</h1>
          </div>
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800 text-sm">Back</button>
        </div>

        {/* Property Images */}
        <div className="relative">
          {property.images && property.images.length > 0 ? (
            <div className="relative">
              <PropertyImageGallery 
                images={property.images}
                propertyId={property.id}
                readOnly={true}
              />
              
              {/* Status Badge */}
              <div className="absolute top-4 right-4 z-10">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(property.status || 'available')}`}>
                  {property.status || 'available'}
                </span>
              </div>
            </div>
          ) : (
            <div className="h-48 bg-gray-100 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-2">🏠</div>
                <div className="text-sm">No images uploaded</div>
              </div>
            </div>
          )}
        </div>

        {/* Property Info */}
        <div className="px-4 py-4 space-y-4">
          {/* Title and Type */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">{property.title}</h2>
            <p className="text-sm text-gray-600 capitalize">{property.property_type}</p>
          </div>

          {/* Description */}
          {property.description && (
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Description</h3>
              <p className="text-gray-700 text-sm leading-relaxed">{property.description}</p>
            </div>
          )}

          {/* Location */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Location</h3>
            <div className="text-gray-700 text-sm space-y-1">
              <div>{property.address}</div>
              <div>{property.city}, {property.province}</div>
              {property.postal_code && <div>{property.postal_code}</div>}
            </div>
          </div>

          {/* Property Details */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Property Details</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {property.bedrooms && (
                <div className="text-center">
                  <div className="text-gray-500">Bedrooms</div>
                  <div className="font-medium text-gray-900">{property.bedrooms}</div>
                </div>
              )}
              {property.bathrooms && (
                <div className="text-center">
                  <div className="text-gray-500">Bathrooms</div>
                  <div className="font-medium text-gray-900">{property.bathrooms}</div>
                </div>
              )}
              {property.parking_spaces && (
                <div className="text-center">
                  <div className="text-gray-500">Parking</div>
                  <div className="font-medium text-gray-900">{property.parking_spaces}</div>
                </div>
              )}
            </div>
          </div>

          {/* Property Amenities */}
          {property.amenities && property.amenities.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Property Amenities</h3>
              <div className="flex flex-wrap gap-2">
                {property.amenities.map((amenity, index) => (
                  <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    {amenity.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Services Provided */}
          {property.services_provided && property.services_provided.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Services Provided</h3>
              <div className="flex flex-wrap gap-2">
                {property.services_provided.map((service, index) => (
                  <span key={index} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                    {service.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Financial Details */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Financial Details</h3>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Monthly Rent</span>
                <span className="font-semibold text-gray-900">{formatCurrency(property.rent_amount)}</span>
              </div>
              {property.deposit_amount && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Deposit</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(property.deposit_amount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Occupancy Information */}
          {property.status === 'occupied' && lease && tenant && (
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Current Occupancy</h3>
              <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tenant</span>
                  <span className="font-medium text-gray-900">{tenant.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email</span>
                  <span className="text-gray-900">{tenant.email}</span>
                </div>
                {tenant.phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Phone</span>
                    <span className="text-gray-900">{tenant.phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Lease Start</span>
                  <span className="text-gray-900">{new Date(lease.lease_start).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Lease End</span>
                  <span className="text-gray-900">{new Date(lease.lease_end).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Monthly Rent</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(lease.rent_amount)}</span>
                </div>
                {lease.deposit_amount && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Deposit Paid</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(lease.deposit_amount)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Amenities */}
          {property.amenities && property.amenities.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Amenities</h3>
              <div className="flex flex-wrap gap-2">
                {property.amenities.map((amenity, index) => (
                  <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 space-y-3">
            <button
              data-testid="edit-property-btn"
              onClick={() => router.push(`/dashboard/owner/properties/${property.id}/edit`)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              ✏️ Edit Property Details
            </button>
            
            {property.status === 'occupied' && (
              <button
                data-testid="manage-lease-btn"
                onClick={() => router.push(`/dashboard/owner/contracts?property=${property.id}`)}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                📋 Manage Lease
              </button>
            )}
            
            <button
              data-testid="back-to-properties-btn"
              onClick={() => router.push('/dashboard/owner/properties')}
              className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              ← Back to Properties
            </button>
          </div>
        </div>

        <BottomNavbar userRole="owner" />
      </div>
    </ProtectedRoute>
  )
}

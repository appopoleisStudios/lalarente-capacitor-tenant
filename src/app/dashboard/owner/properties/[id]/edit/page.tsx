'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import BottomNavbar from '@/components/BottomNavbar'
import PropertyImageGallery from '@/components/PropertyImageGallery'
import GoogleMapsAutocomplete, { extractAddressComponents } from '@/components/GoogleMapsAutocomplete'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/supabase'
import { ArrowLeft } from 'lucide-react'

type Property = Database['public']['Tables']['properties']['Row']
type PropertyUpdate = Database['public']['Tables']['properties']['Update']

export default function EditPropertyPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuthStore()
  
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const propertyId = params.id as string

  const [form, setForm] = useState({
    title: '',
    description: '',
    address: '',
    city: '',
    province: '',
    postal_code: '',
    property_type: 'apartment',
    bedrooms: '' as number | '',
    bathrooms: '' as number | '',
    parking_spaces: '' as number | '',
    rent_amount: '',
    deposit_amount: '',
    status: 'available' as const,
    amenities: [] as string[],
    services_provided: [] as string[]
  })

  const [newAmenity, setNewAmenity] = useState('')
  const [newService, setNewService] = useState('')

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
        setForm({
          title: data.title,
          description: data.description || '',
          address: data.address,
          city: data.city,
          province: data.province,
          postal_code: data.postal_code || '',
          property_type: data.property_type,
          bedrooms: data.bedrooms || '',
          bathrooms: data.bathrooms || '',
          parking_spaces: data.parking_spaces || '',
          rent_amount: data.rent_amount.toString(),
          deposit_amount: data.deposit_amount?.toString() || '',
          status: (data.status as any) || 'available',
          amenities: data.amenities || [],
          services_provided: data.services_provided || []
        })
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load property')
      } finally {
        setLoading(false)
      }
    }

    loadProperty()
  }, [user, propertyId])

  // handlers are unused; remove to satisfy TS6133 while keeping gallery component for images
  /* const handleImageUpload = async (file: File) => {
    if (!user || !property) return

    try {
      setUploading(true)
      
      // Create unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${property.id}/${Date.now()}.${fileExt}`
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('property-images')
        .getPublicUrl(fileName)

      // Add to property images array
      const currentImages = property.images || []
      const updatedImages = [...currentImages, publicUrl]

      // Update property in database
      const { error: updateError } = await supabase
        .from('properties')
        .update({ images: updatedImages })
        .eq('id', property.id)

      if (updateError) throw updateError

      // Update local state
      setProperty(prev => prev ? { ...prev, images: updatedImages } : null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setUploading(false)
    }
  } */

  /* const handleRemoveImage = async (imageUrl: string) => {
    if (!property) return
    try {
      const currentImages = property.images || []
      const updatedImages = currentImages.filter(img => img !== imageUrl)
      const { error } = await supabase
        .from('properties')
        .update({ images: updatedImages })
        .eq('id', property.id)
      if (error) throw error
      setProperty(prev => prev ? { ...prev, images: updatedImages } : null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove image')
    }
  } */

  const addAmenity = () => {
    if (newAmenity.trim() && !form.amenities.includes(newAmenity.trim())) {
      setForm(prev => ({
        ...prev,
        amenities: [...prev.amenities, newAmenity.trim()]
      }))
      setNewAmenity('')
    }
  }

  const addCustomService = () => {
    if (newService.trim() && !form.services_provided.includes(newService.trim())) {
      setForm(prev => ({
        ...prev,
        services_provided: [...prev.services_provided, newService.trim()]
      }))
      setNewService('')
    }
  }

  const removeService = (service: string) => {
    setForm(prev => ({
      ...prev,
      services_provided: prev.services_provided.filter(s => s !== service)
    }))
  }

  const handleAddressSelect = (address: string, place?: any) => {
    setForm(prev => ({
      ...prev,
      address: address
    }))

    // Auto-populate city, province, and postal code if place details are available
    if (place) {
      const components = extractAddressComponents(place)
      
      setForm(prev => ({
        ...prev,
        address: components.fullAddress,
        city: components.city || prev.city,
        province: components.province || prev.province,
        postal_code: components.postalCode || prev.postal_code
      }))
    }
  }

  const removeAmenity = (amenity: string) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.filter(a => a !== amenity)
    }))
  }

  const handleAmenityChange = (amenity: string, checked: boolean) => {
    setForm(prev => ({
      ...prev,
      amenities: checked 
        ? [...prev.amenities, amenity]
        : prev.amenities.filter(a => a !== amenity)
    }))
  }

  const handleServiceChange = (service: string, checked: boolean) => {
    setForm(prev => ({
      ...prev,
      services_provided: checked 
        ? [...prev.services_provided, service]
        : prev.services_provided.filter(s => s !== service)
    }))
  }

  const amenityOptions = [
    { value: 'pool', label: 'Pool' },
    { value: 'lapa', label: 'Lapa' },
    { value: 'fireplace', label: 'Fireplace' },
    { value: 'bbq', label: 'BBQ' },
    { value: 'visitors_parking', label: 'Visitors Parking' }
  ]

  const serviceOptions = [
    { value: 'garden_services', label: 'Garden Services' },
    { value: 'internet', label: 'Internet' },
    { value: 'satellite_systems', label: 'Satellite Systems' },
    { value: 'prepaid_water_electricity', label: 'Prepaid Water and Electricity' },
    { value: 'security', label: 'Security' }
  ]

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !property) return

    setError(null)
    try {
      setSaving(true)

      const updateData: PropertyUpdate = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        address: form.address.trim(),
        city: form.city.trim(),
        province: form.province.trim(),
        postal_code: form.postal_code.trim() || null,
        property_type: form.property_type.trim(),
        bedrooms: form.bedrooms === '' ? null : Number(form.bedrooms),
        bathrooms: form.bathrooms === '' ? null : Number(form.bathrooms),
        parking_spaces: form.parking_spaces === '' ? null : Number(form.parking_spaces),
        rent_amount: Number(form.rent_amount),
        deposit_amount: form.deposit_amount?.trim() ? Number(form.deposit_amount) : null,
        status: form.status,
        amenities: form.amenities.length > 0 ? form.amenities : null,
        services_provided: form.services_provided.length > 0 ? form.services_provided : null
      }

      const { error } = await supabase
        .from('properties')
        .update(updateData)
        .eq('id', property.id)

      if (error) throw error

      router.push(`/dashboard/owner/properties/${property.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update property')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['owner']}>
        <div className="max-w-sm mx-auto min-h-screen bg-white pb-24">
          <div className="px-4 py-4 border-b flex items-center justify-between">
            <h1 className="font-semibold text-gray-900">Edit Property</h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800 text-sm">Cancel</button>
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
            <h1 className="font-semibold text-gray-900">Edit Property</h1>
            <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800 text-sm">Cancel</button>
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
            <h1 className="font-semibold text-gray-900">Edit Property</h1>
          </div>
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800 text-sm">Cancel</button>
        </div>

        <form onSubmit={onSubmit} className="px-4 py-4 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}

          {/* Image Management */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Property Images</h3>
            <PropertyImageGallery
              propertyId={propertyId}
              images={property?.images || []}
              onImagesChange={(newImages) => {
                if (property) {
                  setProperty({ ...property, images: newImages })
                }
              }}
              uploading={uploading}
              onUploadingChange={setUploading}
            />
          </div>

          {/* Basic Info */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Title *</label>
                <input 
                  value={form.title} 
                  onChange={e => setForm(s => ({...s, title: e.target.value}))} 
                  className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" 
                  required 
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Description</label>
                <textarea 
                  value={form.description} 
                  onChange={e => setForm(s => ({...s, description: e.target.value}))} 
                  className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" 
                  rows={3} 
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Property Type *</label>
                <select 
                  value={form.property_type} 
                  onChange={e => setForm(s => ({...s, property_type: e.target.value}))} 
                  className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  required
                >
                  <option value="apartment">Apartment</option>
                  <option value="house">House</option>
                  <option value="townhouse">Townhouse</option>
                  <option value="studio">Studio</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Status *</label>
                <select 
                  value={form.status} 
                  onChange={e => setForm(s => ({...s, status: e.target.value as any}))} 
                  className="w-full border rounded-lg px-3 py-2 text-gray-900"
                  required
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Location</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Address *</label>
                <GoogleMapsAutocomplete
                  value={form.address}
                  onChange={handleAddressSelect}
                  placeholder="Start typing your address..."
                  className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">City *</label>
                  <input 
                    value={form.city} 
                    onChange={e => setForm(s => ({...s, city: e.target.value}))} 
                    className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Province *</label>
                  <input 
                    value={form.province} 
                    onChange={e => setForm(s => ({...s, province: e.target.value}))} 
                    className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" 
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Postal Code</label>
                <input 
                  value={form.postal_code} 
                  onChange={e => setForm(s => ({...s, postal_code: e.target.value}))} 
                  className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" 
                />
              </div>
            </div>
          </div>

          {/* Property Details */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Property Details</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Bedrooms</label>
                <input 
                  value={form.bedrooms} 
                  onChange={e => setForm(s => ({...s, bedrooms: e.target.value === '' ? '' : Number(e.target.value)}))} 
                  type="number" 
                  min={0} 
                  className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" 
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Bathrooms</label>
                <input 
                  value={form.bathrooms} 
                  onChange={e => setForm(s => ({...s, bathrooms: e.target.value === '' ? '' : Number(e.target.value)}))} 
                  type="number" 
                  min={0} 
                  className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" 
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Parking</label>
                <input 
                  value={form.parking_spaces} 
                  onChange={e => setForm(s => ({...s, parking_spaces: e.target.value === '' ? '' : Number(e.target.value)}))} 
                  type="number" 
                  min={0} 
                  className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" 
                />
              </div>
            </div>
          </div>

          {/* Financial Details */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Financial Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Rent Amount (R) *</label>
                <input 
                  value={form.rent_amount} 
                  onChange={e => setForm(s => ({...s, rent_amount: e.target.value}))} 
                  type="number" 
                  min={0} 
                  step="0.01" 
                  className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Deposit (R)</label>
                <input 
                  value={form.deposit_amount} 
                  onChange={e => setForm(s => ({...s, deposit_amount: e.target.value}))} 
                  type="number" 
                  min={0} 
                  step="0.01" 
                  className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" 
                />
              </div>
            </div>
          </div>

          {/* Property Amenities */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Property Amenities</h3>
            
            {/* Predefined Amenities */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {amenityOptions.map((amenity) => (
                <label key={amenity.value} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.amenities.includes(amenity.value)}
                    onChange={(e) => handleAmenityChange(amenity.value, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {amenity.label}
                </label>
              ))}
            </div>

            {/* Custom Amenities */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={newAmenity}
                  onChange={e => setNewAmenity(e.target.value)}
                  placeholder="Add custom amenity..."
                  className="flex-1 border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600 text-sm"
                  onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addAmenity())}
                />
                <button
                  type="button"
                  onClick={addAmenity}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm"
                >
                  Add
                </button>
              </div>
              
              {/* Selected Amenities Display */}
              {form.amenities.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.amenities.map((amenity, index) => (
                    <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs flex items-center gap-1">
                      {amenity.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      <button
                        type="button"
                        onClick={() => removeAmenity(amenity)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Services Provided */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Services Provided</h3>
            
            {/* Predefined Services */}
            <div className="grid grid-cols-1 gap-2 mb-3">
              {serviceOptions.map((service) => (
                <label key={service.value} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.services_provided.includes(service.value)}
                    onChange={(e) => handleServiceChange(service.value, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {service.label}
                </label>
              ))}
            </div>

            {/* Custom Services */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={newService}
                  onChange={e => setNewService(e.target.value)}
                  placeholder="Add custom service..."
                  className="flex-1 border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600 text-sm"
                  onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addCustomService())}
                />
                <button
                  type="button"
                  onClick={addCustomService}
                  className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm"
                >
                  Add
                </button>
              </div>
              
              {/* Selected Services Display */}
              {form.services_provided.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.services_provided.map((service, index) => (
                    <span key={index} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs flex items-center gap-1">
                      {service.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      <button
                        type="button"
                        onClick={() => removeService(service)}
                        className="text-green-600 hover:text-green-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <button 
              type="submit"
              data-testid="save-property-btn"
              disabled={saving} 
              className="w-full px-3 py-3 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-60"
            >
              {saving ? 'Saving…' : '💾 Save Changes'}
            </button>
          </div>
        </form>

        <BottomNavbar userRole="owner" />
      </div>
    </ProtectedRoute>
  )
}

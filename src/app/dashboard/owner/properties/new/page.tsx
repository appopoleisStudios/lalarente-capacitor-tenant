'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import BottomNavbar from '@/components/BottomNavbar'
import GoogleMapsAutocomplete, { extractAddressComponents } from '@/components/GoogleMapsAutocomplete'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'

type FormState = {
  title: string
  description: string
  address: string
  city: string
  province: string
  postal_code: string
  property_type: string
  bedrooms?: number | ''
  bathrooms?: number | ''
  parking_spaces?: number | ''
  rent_amount: string
  deposit_amount?: string
  amenities: string[]
  services_provided: string[]
}

export default function NewOwnerPropertyPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    address: '',
    city: '',
    province: '',
    postal_code: '',
    property_type: 'apartment',
    bedrooms: '',
    bathrooms: '',
    parking_spaces: '',
    rent_amount: '',
    deposit_amount: '',
    amenities: [],
    services_provided: []
  })

  const [newAmenity, setNewAmenity] = useState('')
  const [newService, setNewService] = useState('')

  const requiredOk = () => {
    if (!form.title.trim()) return false
    if (!form.address.trim()) return false
    if (!form.city.trim()) return false
    if (!form.province.trim()) return false
    if (!form.property_type.trim()) return false
    const rent = Number(form.rent_amount)
    if (!Number.isFinite(rent) || rent < 0) return false
    return true
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

  const addCustomAmenity = () => {
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

  const removeAmenity = (amenity: string) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.filter(a => a !== amenity)
    }))
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
    if (!user) return
    setError(null)
    if (!requiredOk()) {
      setError('Please fill required fields correctly')
      return
    }
    try {
      setSaving(true)
      const bedrooms = form.bedrooms === '' ? null : Number(form.bedrooms)
      const bathrooms = form.bathrooms === '' ? null : Number(form.bathrooms)
      const parking = form.parking_spaces === '' ? null : Number(form.parking_spaces)
      const deposit = form.deposit_amount?.trim() ? Number(form.deposit_amount) : null
      const rent = Number(form.rent_amount)

      const { data, error } = await supabase
        .from('properties')
        .insert({
          owner_id: user.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          address: form.address.trim(),
          city: form.city.trim(),
          province: form.province.trim(),
          postal_code: form.postal_code.trim() || null,
          property_type: form.property_type.trim(),
          bedrooms: bedrooms as number | null,
          bathrooms: bathrooms as number | null,
          parking_spaces: parking as number | null,
          rent_amount: rent,
          deposit_amount: deposit as number | null,
          amenities: form.amenities.length > 0 ? form.amenities : null,
          services_provided: form.services_provided.length > 0 ? form.services_provided : null,
          status: 'available'
        })
        .select('id')
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('No row returned')

      router.replace(`/dashboard/owner/properties/${data.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create property')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div className="max-w-sm mx-auto min-h-screen bg-white pb-24">
        <div className="px-4 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h1 className="font-semibold text-gray-900">Add Property</h1>
          </div>
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800 text-sm">Cancel</button>
        </div>

        <form onSubmit={onSubmit} className="px-4 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-sm text-gray-700 mb-1">Title *</label>
            <input data-testid="title" value={form.title} onChange={e=>setForm(s=>({...s,title:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" placeholder="e.g., Rosebank Lofts 2B" required />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">Property Amenities</label>
            
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
                  onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addCustomAmenity())}
                />
                <button
                  type="button"
                  onClick={addCustomAmenity}
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

          <div>
            <label className="block text-sm text-gray-700 mb-1">Services Provided</label>
            
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

          <div>
            <label className="block text-sm text-gray-700 mb-1">Additional Description</label>
            <textarea data-testid="description" value={form.description} onChange={e=>setForm(s=>({...s,description:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" rows={3} placeholder="Optional additional details, notes, special features..." />
          </div>

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
              <input data-testid="city" value={form.city} onChange={e=>setForm(s=>({...s,city:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" required />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Province/State *</label>
              <input data-testid="province" value={form.province} onChange={e=>setForm(s=>({...s,province:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Postal Code</label>
              <input data-testid="postal" value={form.postal_code} onChange={e=>setForm(s=>({...s,postal_code:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Property Type *</label>
              <input data-testid="ptype" value={form.property_type} onChange={e=>setForm(s=>({...s,property_type:e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Bedrooms</label>
              <input data-testid="bedrooms" value={form.bedrooms} onChange={e=>setForm(s=>({...s,bedrooms:e.target.value === '' ? '' : Number(e.target.value)}))} type="number" min={0} className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Bathrooms</label>
              <input data-testid="bathrooms" value={form.bathrooms} onChange={e=>setForm(s=>({...s,bathrooms:e.target.value === '' ? '' : Number(e.target.value)}))} type="number" min={0} className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Parking</label>
              <input data-testid="parking" value={form.parking_spaces} onChange={e=>setForm(s=>({...s,parking_spaces:e.target.value === '' ? '' : Number(e.target.value)}))} type="number" min={0} className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Rent Amount (R) *</label>
              <input data-testid="rent" value={form.rent_amount} onChange={e=>setForm(s=>({...s,rent_amount:e.target.value}))} type="number" min={0} step="0.01" className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" required />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Deposit (R)</label>
              <input data-testid="deposit" value={form.deposit_amount} onChange={e=>setForm(s=>({...s,deposit_amount:e.target.value}))} type="number" min={0} step="0.01" className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600" />
            </div>
          </div>

          <div className="pt-2">
            <button data-testid="create-property-btn" disabled={saving} className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-60">
              {saving ? 'Saving…' : '🏠 Create Property'}
            </button>
          </div>
        </form>

        <BottomNavbar userRole="owner" />
      </div>
    </ProtectedRoute>
  )
}



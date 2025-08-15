'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import BottomNavbar from '@/components/BottomNavbar'

type Property = {
  id: string
  title: string
  address: string
}

type ServiceCategory = {
  id: string
  name: string
  description: string | null
}

export default function NewMaintenanceRequestPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  
  const [formData, setFormData] = useState({
    property_id: '',
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    category_id: '',
    images: [] as File[]
  })

  useEffect(() => {
    if (!user) return
    
    const loadData = async () => {
      try {
        // Load owner's properties
        console.log('Loading properties for user:', user.id, user.email)
        const { data: props, error: propsError } = await supabase
          .from('properties')
          .select('id, title, address')
          .eq('owner_id', user.id)
          .order('title')
        
        console.log('Properties query result:', { props, propsError })
        if (props) setProperties(props)
        
        // Load service categories
        const { data: cats } = await supabase
          .from('service_categories')
          .select('id, name, description')
          .order('name')
        
        if (cats) setCategories(cats)
      } catch (err) {
        console.error('Error loading data:', err)
        setError('Failed to load properties and categories')
      }
    }
    
    loadData()
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    
    setLoading(true)
    setError(null)
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabase
      // Create maintenance request
      const requestData = {
        property_id: formData.property_id,
        owner_id: user.id,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: 'open' as const,
        mms_status: 'notification' as const
      }
      console.log('Creating maintenance request with data:', requestData)
      
      const { data: request, error: reqError } = await sb
        .from('maintenance_requests')
        .insert(requestData)
        .select('id')
        .single()
      
      if (reqError) throw reqError
      
      // Log the notification event
      await sb
        .from('maintenance_request_audit_logs')
        .insert({
          request_id: request.id,
          event: 'notification_raised',
          actor_id: user.id,
          data: { priority: formData.priority, category_id: formData.category_id }
        })
      
      // Route to vendors (this will create vendor_quote_requests)
      console.log('Calling RPC with request_id:', request.id)
      const { error: rpcError } = await sb.rpc('route_maintenance_request_to_vendors', {
        p_request_id: request.id,
        p_quote_deadline_hours: 24
      })
      if (rpcError) {
        console.error('RPC error:', rpcError)
        throw rpcError
      }
      
      router.push('/dashboard/owner/maintenance')
    } catch (err) {
      console.error('Error creating maintenance request:', err)
      console.error('Error details:', JSON.stringify(err, null, 2))
      setError(err instanceof Error ? err.message : 'Failed to create maintenance request')
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setFormData(prev => ({ ...prev, images: [...prev.images, ...files] }))
  }

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div className="max-w-sm mx-auto bg-white min-h-screen pb-20">
        <div className="px-4 py-4 flex items-center justify-between border-b">
          <h1 className="font-semibold text-gray-900">New Maintenance Request</h1>
          <button 
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="px-4 py-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          
          {/* Property Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Property *
            </label>
            <select
              required
              value={formData.property_id}
              onChange={(e) => setFormData(prev => ({ ...prev, property_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
            >
              <option value="">Select a property</option>
              {properties.map(prop => (
                <option key={prop.id} value={prop.id}>
                  {prop.title} - {prop.address}
                </option>
              ))}
            </select>
          </div>
          
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Issue Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Geyser burst, Electrical fault"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-500"
            />
          </div>
          
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the issue in detail..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-500"
            />
          </div>
          
          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority *
            </label>
            <select
              required
              value={formData.priority}
              onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
            >
              <option value="low">Low - Non-urgent</option>
              <option value="medium">Medium - Standard</option>
              <option value="high">High - Urgent</option>
            </select>
          </div>
          
          {/* Service Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Category
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
            >
              <option value="">Select category (optional)</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photos/Videos
            </label>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleImageUpload}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {formData.images.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                {formData.images.length} file(s) selected
              </div>
            )}
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Request...' : 'Create Maintenance Request'}
          </button>
        </form>
        
        <BottomNavbar userRole="owner" />
      </div>
    </ProtectedRoute>
  )
}

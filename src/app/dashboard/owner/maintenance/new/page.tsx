'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import BottomNavbar from '@/components/BottomNavbar'
import { ArrowLeft } from 'lucide-react'

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
  const [vendorOptions, setVendorOptions] = useState<{ id: string; name: string }[]>([])
  const [dvCount, setDvCount] = useState<number>(0)
  const [vendorSearch, setVendorSearch] = useState('')
  const [vendorSearchResults, setVendorSearchResults] = useState<{ id: string; name: string; email?: string; phone?: string }[]>([])
  
  const [formData, setFormData] = useState({
    property_id: '',
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    category_id: '',
    images: [] as File[],
    open_market: true,
    selected_vendor_ids: [] as string[]
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

  // Load dedicated vendors when property or category changes
  useEffect(() => {
    const fetchVendors = async () => {
      if (!user || !formData.property_id) { setVendorOptions([]); setDvCount(0); return }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb: any = supabase
        let query = sb
          .from('dedicated_vendors' as string)
          .select('vendor_id, category_id, vendor:profiles!dedicated_vendors_vendor_id_fkey(full_name)')
          .eq('property_id', formData.property_id)
          .eq('is_active', true)

        // If a category is selected, include rows scoped to that category OR unscoped (null)
        if (formData.category_id) {
          query = query.or(`category_id.is.null,category_id.eq.${formData.category_id}`)
        }

        const { data, error } = await query
        if (error) throw error
        const rows = (data || []) as { vendor_id: string; vendor: { full_name: string } }[]
        setDvCount(rows.length)
        const opts = rows.map((r) => ({ id: r.vendor_id, name: r.vendor?.full_name || 'Vendor' }))
        setVendorOptions(opts)
      } catch (e) {
        console.error('Failed loading vendors', e)
        setVendorOptions([]); setDvCount(0)
      }
    }
    fetchVendors()
  }, [user, formData.property_id, formData.category_id])

  // Search vendors by name/email/phone (lightweight OR query)
  useEffect(() => {
    const run = async () => {
      if (!user) return
      const term = vendorSearch.trim()
      if (term.length < 2) { setVendorSearchResults([]); return }
      try {
        const { data, error } = await supabase
          .rpc('search_vendors_minimal', { p_term: term, p_limit: 10 })
        if (error) throw error
        const rows = ((data || []) as { id: string; full_name: string | null; email: string | null; phone: string | null }[])
          .map((p) => ({ id: p.id, name: p.full_name || 'Vendor', email: p.email || undefined, phone: p.phone || undefined }))
        setVendorSearchResults(rows.map(r => ({
          id: r.id,
          name: r.name,
          ...(r.email ? { email: r.email } : {}),
          ...(r.phone ? { phone: r.phone } : {}),
        })))
      } catch (e) {
        console.error('Vendor search failed', e)
        setVendorSearchResults([])
      }
    }
    run()
  }, [user, vendorSearch])

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
        mms_status: 'notification' as const,
        visibility: (formData.open_market ? 'public' : 'invited') as 'public' | 'invited'
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
      
      // Routing based on open_market / invitations
      const quoteDeadlineISO = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
      if (formData.open_market) {
        await sb.from('maintenance_requests')
          .update({ mms_status: 'vendor_routed', vendor_routed_at: new Date().toISOString(), quote_deadline: quoteDeadlineISO })
          .eq('id', request.id)
        await sb.from('maintenance_request_audit_logs').insert({ request_id: request.id, event: 'vendor_routed', actor_id: user.id, data: { visibility: 'public', quote_deadline: quoteDeadlineISO } })
      } else if (formData.selected_vendor_ids.length > 0) {
        const rows = formData.selected_vendor_ids.map(vendor_id => ({ request_id: request.id, vendor_id, response_deadline: quoteDeadlineISO }))
        await sb.from('vendor_quote_requests').insert(rows)
        await sb.from('maintenance_requests')
          .update({ mms_status: 'vendor_routed', vendor_routed_at: new Date().toISOString(), quote_deadline: quoteDeadlineISO })
          .eq('id', request.id)
        await sb.from('maintenance_request_audit_logs').insert({ request_id: request.id, event: 'vendor_routed', actor_id: user.id, data: { invited: formData.selected_vendor_ids, quote_deadline: quoteDeadlineISO } })
      } else {
        // Default behavior: route via RPC to dedicated vendors
        const { error: rpcError } = await sb.rpc('route_maintenance_request_to_vendors', {
          p_request_id: request.id,
          p_quote_deadline_hours: 24
        })
        if (rpcError) throw rpcError
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h1 className="font-semibold text-gray-900">New Maintenance Request</h1>
          </div>
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
          
          {/* Visibility & Invitations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="radio" name="visibility" checked={formData.open_market} onChange={()=>setFormData(prev=>({...prev, open_market: true }))} />
                Post to Open Market (public)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="radio" name="visibility" checked={!formData.open_market} onChange={()=>setFormData(prev=>({...prev, open_market: false }))} />
                Invite Vendors
              </label>
            </div>
            {!formData.open_market && (
              <div className="text-xs text-gray-600 mb-2">
                {dvCount > 0
                  ? `You have ${dvCount} dedicated vendor${dvCount>1?'s':''} for this property${formData.category_id ? ' (including category/unscoped)' : ''}. Select specific vendors below or leave empty to invite all.`
                  : 'No dedicated vendors found for this selection. Leaving this empty will post to Open Market.'}
              </div>
            )}
            {!formData.open_market && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-xs text-gray-600 mb-2">Invite dedicated vendors for this property</div>
                {dvCount === 0 && (
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs text-gray-500 pr-3">No dedicated vendors yet. Start onboarding to invite your preferred vendor.</div>
                    <button
                      type="button"
                      onClick={() => {
                        const qs = new URLSearchParams()
                        if (formData.property_id) qs.set('property_id', formData.property_id)
                        if (formData.category_id) qs.set('category_id', formData.category_id)
                        router.push(`/dashboard/owner/dedicated-vendors?${qs.toString()}`)
                      }}
                      className="text-xs bg-indigo-600 text-white px-2.5 py-1.5 rounded-md hover:bg-indigo-700"
                    >
                      Onboard a dedicated vendor
                    </button>
                  </div>
                )}
                {vendorOptions.length === 0 ? (
                  <div className="text-xs text-gray-500">No dedicated vendors found for this property.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {vendorOptions.map(v => (
                      <label key={v.id} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={formData.selected_vendor_ids.includes(v.id)}
                          onChange={(e)=>{
                            const checked = e.target.checked
                            setFormData(prev=> ({
                              ...prev,
                              selected_vendor_ids: checked ? [...prev.selected_vendor_ids, v.id] : prev.selected_vendor_ids.filter(id=>id!==v.id)
                            }))
                          }}
                        />
                        {v.name}
                      </label>
                    ))}
                  </div>
                )}

                {/* Vendor search */}
                <div className="mt-3 border-t pt-3">
                  <div className="text-xs text-gray-600 mb-2">Search vendors by name, email, or phone</div>
                  <input
                    type="text"
                    value={vendorSearch}
                    onChange={(e)=>setVendorSearch(e.target.value)}
                    placeholder="Type at least 2 characters..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-500"
                  />
                  {vendorSearchResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                      {vendorSearchResults.map(r => (
                        <button
                          type="button"
                          key={r.id}
                          onClick={() => setFormData(prev => ({ ...prev, selected_vendor_ids: prev.selected_vendor_ids.includes(r.id) ? prev.selected_vendor_ids : [...prev.selected_vendor_ids, r.id] }))}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          <div className="font-medium text-gray-900">{r.name}</div>
                          <div className="text-xs text-gray-500">{r.email || ''}{r.phone ? (r.email ? ' • ' : '') + r.phone : ''}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
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

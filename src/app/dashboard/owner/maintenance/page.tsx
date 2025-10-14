'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import BottomNavbar from '@/components/BottomNavbar'
import { ArrowLeft } from 'lucide-react'

type MaintenanceRequest = {
  id: string
  title: string
  description: string
  priority: string
  status: string
  mms_status: string
  created_at: string
  property: {
    title: string
    address: string
  } | null
  quotes_count: number
  selected_vendor: {
    full_name: string
  } | null
}

export default function OwnerMaintenancePage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'completed'>('all')

  useEffect(() => {
    if (!user) return
    
    const loadRequests = async () => {
      try {
        // Step 1: fetch only base rows to avoid RLS issues on embedded joins
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb: any = supabase
        const { data: baseRows, error: baseError } = await sb
          .from('maintenance_requests')
          .select('id,title,description,priority,status,mms_status,created_at,property_id,selected_vendor_id')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })

        if (baseError) {
          console.error('Owner maintenance list base query error:', baseError)
          throw baseError
        }

        type MRBase = {
          id: string
          title: string
          description: string
          priority: string
          status: string
          mms_status: string
          created_at: string
          property_id: string | null
          selected_vendor_id: string | null
        }
        const requestsBase = (baseRows || []) as MRBase[]

        // Step 2: hydrate properties (owner-owned only)
        const propertyIds = Array.from(new Set(requestsBase.map((r) => r.property_id).filter(Boolean))) as string[]
        let propertyMap: Record<string, { title: string; address: string }> = {}
        if (propertyIds.length > 0) {
          const { data: propsData, error: propsErr } = await sb
            .from('properties')
            .select('id,title,address')
            .in('id', propertyIds)
            .eq('owner_id', user.id)

          if (propsErr) {
            console.error('Owner maintenance properties hydrate error:', propsErr)
          } else {
            propertyMap = (propsData || []).reduce((acc: Record<string, { title: string; address: string }>, p: { id: string; title: string; address: string }) => {
              acc[p.id] = { title: p.title, address: p.address }
              return acc
            }, {})
          }
        }

        // Step 3: hydrate selected vendor names (optional)
        const vendorIds = Array.from(new Set(requestsBase.map((r) => r.selected_vendor_id).filter(Boolean))) as string[]
        let vendorMap: Record<string, { full_name: string }> = {}
        if (vendorIds.length > 0) {
          const { data: vendorsData, error: vendorsErr } = await sb
            .from('profiles')
            .select('id,full_name')
            .in('id', vendorIds)

          if (vendorsErr) {
            console.error('Owner maintenance vendors hydrate error:', vendorsErr)
          } else {
            vendorMap = (vendorsData || []).reduce((acc: Record<string, { full_name: string }>, v: { id: string; full_name: string }) => {
              acc[v.id] = { full_name: v.full_name }
              return acc
            }, {})
          }
        }
        
        // Get quote counts for each request in ONE batched query
        const requestIdsForCounts = requestsBase.map(r => r.id)
        let quotesCountMap: Record<string, number> = {}
        if (requestIdsForCounts.length > 0) {
          const { data: quotesRows, error: quotesErr } = await sb
            .from('quotes')
            .select('request_id')
            .in('request_id', requestIdsForCounts)
          if (quotesErr) {
            console.error('Owner maintenance quotes count batch error:', quotesErr)
          } else {
            quotesCountMap = (quotesRows || []).reduce((acc: Record<string, number>, q: { request_id: string }) => {
              acc[q.request_id] = (acc[q.request_id] || 0) + 1
              return acc
            }, {})
          }
        }

        const requestsWithQuotes = requestsBase.map((req: MRBase) => ({
          ...req,
          property: req.property_id ? propertyMap[req.property_id] || null : null,
          selected_vendor: req.selected_vendor_id ? vendorMap[req.selected_vendor_id] || null : null,
          quotes_count: quotesCountMap[req.id] || 0
        }))
        
        setRequests(requestsWithQuotes)
      } catch (err) {
        console.error('Error loading maintenance requests:', err)
      } finally {
        setLoading(false)
      }
    }
    
    loadRequests()
  }, [user])

  const getStatusColor = (mmsStatus: string) => {
    switch (mmsStatus) {
      case 'notification': return 'bg-yellow-100 text-yellow-800'
      case 'acknowledged': return 'bg-blue-100 text-blue-800'
      case 'vendor_routed': return 'bg-purple-100 text-purple-800'
      case 'quote_received': return 'bg-orange-100 text-orange-800'
      case 'po_issued': return 'bg-indigo-100 text-indigo-800'
      case 'in_progress': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const getStatusText = (mmsStatus: string) => {
    switch (mmsStatus) {
      case 'notification': return 'Notification Raised'
      case 'acknowledged': return 'Acknowledged'
      case 'vendor_routed': return 'Vendors Contacted'
      case 'quote_received': return 'Quotes Received'
      case 'po_issued': return 'PO Issued'
      case 'in_progress': return 'Work In Progress'
      case 'completed': return 'Completed'
      default: return mmsStatus
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true
    if (filter === 'open') return ['notification', 'acknowledged', 'vendor_routed', 'quote_received'].includes(req.mms_status)
    if (filter === 'in_progress') return ['po_issued', 'in_progress'].includes(req.mms_status)
    if (filter === 'completed') return req.mms_status === 'completed'
    return true
  })

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['owner']}>
        <div className="max-w-sm mx-auto bg-white min-h-screen pb-20">
          <div className="px-4 py-4 flex items-center justify-center">
            <div className="text-gray-500">Loading...</div>
          </div>
        </div>
      </ProtectedRoute>
    )
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
            <h1 className="font-semibold text-gray-900">Maintenance Requests</h1>
          </div>
          <button
            onClick={() => router.push('/dashboard/owner/maintenance/new')}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            New Request
          </button>
        </div>
        
        {/* Filter Tabs */}
        <div className="px-4 py-3 border-b">
          <div className="flex space-x-2">
            {(['all', 'open', 'in_progress', 'completed'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  filter === tab
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Requests List */}
        <div className="px-4 py-4 space-y-4">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 text-sm">
                {filter === 'all' ? 'No maintenance requests yet' : `No ${filter} requests`}
              </div>
              {filter === 'all' && (
                <button
                  onClick={() => router.push('/dashboard/owner/maintenance/new')}
                  className="mt-2 text-indigo-600 text-sm font-medium hover:text-indigo-700"
                >
                  Create your first request
                </button>
              )}
            </div>
          ) : (
            filteredRequests.map(request => (
              <div
                key={request.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/dashboard/owner/maintenance/${request.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900 line-clamp-1">
                    {request.title}
                  </h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                    {request.priority}
                  </span>
                </div>
                
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {request.description}
                </p>
                
                                 <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                   <span>{request.property?.title || 'Unknown Property'}</span>
                   <span>{new Date(request.created_at).toLocaleDateString()}</span>
                 </div>
                
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.mms_status)}`}>
                    {getStatusText(request.mms_status)}
                  </span>
                  
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    {request.quotes_count > 0 && (
                      <span>{request.quotes_count} quote{request.quotes_count !== 1 ? 's' : ''}</span>
                    )}
                    {request.selected_vendor && (
                      <span>• {request.selected_vendor.full_name}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        <BottomNavbar userRole="owner" />
      </div>
    </ProtectedRoute>
  )
}

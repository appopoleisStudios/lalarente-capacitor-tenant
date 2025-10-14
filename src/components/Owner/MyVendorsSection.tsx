"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

type Property = { id: string; title: string }
type Category = { id: string; name: string }

type DedicatedVendorRow = {
  id: string
  property_id: string
  category_id: string | null
  vendor_id: string
  priority: number | null
  is_active: boolean
}

type VendorProfile = { id: string; full_name: string | null }

type Props = { className?: string }

export default function MyVendorsSection({ className = '' }: Props) {
  const router = useRouter()
  const { user } = useAuthStore()
  const [open, setOpen] = useState<boolean>(false)

  const [properties, setProperties] = useState<Property[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedProperty, setSelectedProperty] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [rows, setRows] = useState<DedicatedVendorRow[]>([])
  const [vendorMap, setVendorMap] = useState<Record<string, VendorProfile>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const loadBasics = async () => {
      try {
        setError(null)
        const [propsRes, catsRes] = await Promise.all([
          supabase.from('properties').select('id,title').eq('owner_id', user.id).order('title'),
          supabase.from('service_categories').select('id,name').order('name')
        ])
        if (propsRes.data) setProperties(propsRes.data as Property[])
        if (catsRes.data) setCategories(catsRes.data as Category[])
        if (!selectedProperty && propsRes.data && propsRes.data.length > 0) {
          if (propsRes.data && propsRes.data[0]) {
            setSelectedProperty(propsRes.data[0].id)
          }
        }
      } catch (e) {
        setError('Failed to load properties/categories')
        // eslint-disable-next-line no-console
        console.error(e)
      }
    }
    loadBasics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!user || !selectedProperty) { setRows([]); setVendorMap({}); return }
    const loadRows = async () => {
      try {
        setLoading(true)
        setError(null)
        const dvQuery = supabase
          .from('dedicated_vendors')
          .select('id,property_id,category_id,vendor_id,priority,is_active')
          .eq('property_id', selectedProperty)
          .eq('is_active', true)
          .order('priority', { ascending: true })
        const dvRes = selectedCategory ? await dvQuery.eq('category_id', selectedCategory) : await dvQuery
        const dvRows = (dvRes.data || []) as DedicatedVendorRow[]
        setRows(dvRows)

        const vendorIds = Array.from(new Set(dvRows.map(r => r.vendor_id)))
        if (vendorIds.length > 0) {
          const vRes = await supabase.from('profiles').select('id,full_name').in('id', vendorIds)
          if (vRes.data) {
            const map = (vRes.data as VendorProfile[]).reduce((acc: Record<string, VendorProfile>, v) => { acc[v.id] = v; return acc }, {})
            setVendorMap(map)
          } else {
            setVendorMap({})
          }
        } else {
          setVendorMap({})
        }
      } catch (e) {
        setError('Failed to load vendors')
        // eslint-disable-next-line no-console
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadRows()
  }, [user, selectedProperty, selectedCategory])

  const categoriesForFilter = useMemo(() => categories, [categories])

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">My Vendors</h3>
        <div className="flex items-center gap-2">
          <button onClick={()=>router.push('/dashboard/owner/dedicated-vendors')} className="text-sm text-indigo-600 font-medium hover:text-indigo-700">Manage</button>
          <button onClick={()=>setOpen(v=>!v)} className="text-sm text-gray-600 hover:text-gray-800">{open ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={selectedProperty}
              onChange={(e)=>setSelectedProperty(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
            >
              <option value="">Select property</option>
              {properties.map(p => (<option key={p.id} value={p.id}>{p.title}</option>))}
            </select>
            <select
              value={selectedCategory}
              onChange={(e)=>setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
            >
              <option value="">All categories</option>
              {categoriesForFilter.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>

          <div className="space-y-2">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            {loading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-gray-500">No active dedicated vendors found.</div>
            ) : (
              rows.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{vendorMap[r.vendor_id]?.full_name || r.vendor_id}</div>
                    <div className="text-xs text-gray-500">Priority {r.priority ?? 1}{r.category_id ? ' • Category scoped' : ''}</div>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

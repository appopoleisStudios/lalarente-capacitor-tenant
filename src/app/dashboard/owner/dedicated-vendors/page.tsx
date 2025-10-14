'use client'

import { useEffect, useMemo, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import BottomNavbar from '@/components/BottomNavbar'

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

type AllRow = DedicatedVendorRow & { property_title?: string; category_name?: string; vendor_name?: string }

export default function OwnerDedicatedVendorsPage() {
  const { user } = useAuthStore()
  const [properties, setProperties] = useState<Property[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedProperty, setSelectedProperty] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [rows, setRows] = useState<DedicatedVendorRow[]>([])
  const [vendorMap, setVendorMap] = useState<Record<string, VendorProfile>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add form
  const [newVendorId, setNewVendorId] = useState('')
  const [newPriority, setNewPriority] = useState<number>(1)
  const [vendorSearch, setVendorSearch] = useState('')
  const [vendorResults, setVendorResults] = useState<{ id: string; name: string; email?: string; phone?: string }[]>([])

  // All vendors aggregate
  const [allOpen, setAllOpen] = useState<boolean>(true)
  const [allRows, setAllRows] = useState<AllRow[]>([])
  const [allLoading, setAllLoading] = useState<boolean>(false)

  useEffect(() => {
    if (!user) return
    const loadBasics = async () => {
      try {
        setError(null)
        // parallel: owner's properties and all categories
        const [propsRes, catsRes] = await Promise.all([
          supabase
            .from('properties')
            .select('id,title')
            .eq('owner_id', user.id)
            .order('title'),
          supabase.from('service_categories').select('id,name').order('name')
        ])
        if (propsRes.data) setProperties(propsRes.data as Property[])
        if (catsRes.data) setCategories(catsRes.data as Category[])
        // default select first property if exists
        if (!selectedProperty && propsRes.data && propsRes.data.length > 0) {
          setSelectedProperty((propsRes.data[0] as Property).id)
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

  // Vendor search by full_name/email/phone for onboarding
  useEffect(() => {
    const run = async () => {
      if (!user) return
      const term = vendorSearch.trim()
      if (term.length < 2) { setVendorResults([]); return }
      try {
        const { data, error } = await supabase
          .rpc('search_vendors_minimal', { p_term: term, p_limit: 10 })
        if (error) throw error
        const rows = ((data || []) as { id: string; full_name: string | null; email: string | null; phone: string | null }[])
          .map((p) => ({
            id: p.id,
            name: p.full_name || 'Vendor',
            ...(p.email ? { email: p.email } : {}),
            ...(p.phone ? { phone: p.phone } : {}),
          }))
        setVendorResults(rows)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Vendor search failed', e)
        setVendorResults([])
      }
    }
    run()
  }, [user, vendorSearch])

  // Load ALL dedicated vendors across owner properties
  useEffect(() => {
    if (!user) return
    const loadAll = async () => {
      try {
        setAllLoading(true)
        const { data: props } = await supabase
          .from('properties').select('id,title').eq('owner_id', user.id)
        const propertyIds = (props || []).map(p => p.id)
        if (propertyIds.length === 0) { setAllRows([]); return }
        const { data: dv } = await supabase
          .from('dedicated_vendors')
          .select('id,property_id,category_id,vendor_id,priority,is_active')
          .in('property_id', propertyIds)
          .order('priority', { ascending: true })
        const all = (dv || []) as DedicatedVendorRow[]

        // hydrate maps in batches
        const vendorIds = Array.from(new Set(all.map(r => r.vendor_id)))
        const catIds = Array.from(new Set(all.map(r => r.category_id).filter(Boolean))) as string[]
        // Hydrate vendor names via SECURITY DEFINER RPC to bypass RLS
        const vendorsData: { id: string; full_name: string | null }[] = []
        if (vendorIds.length > 0) {
          const results = await Promise.all(vendorIds.map(async (vid) => {
            const res = await supabase.rpc('get_profile_minimal', { uid: vid })
            const row = Array.isArray(res.data) ? res.data[0] : res.data
            return row ? { id: row.id as string, full_name: (row.full_name as string) || null } : { id: vid, full_name: null }
          }))
          vendorsData.push(...results)
        }
        const vendorNameMap = (vendorsData || []).reduce((acc: Record<string,string>, v)=>{ acc[v.id]=v.full_name||v.id; return acc }, {})
        // Fetch category names (batched) for display
        let catNameMap: Record<string,string> = {}
        if (catIds.length > 0) {
          const { data: catRows } = await supabase.from('service_categories').select('id,name').in('id', catIds)
          catNameMap = (catRows || []).reduce((acc: Record<string,string>, c: { id: string; name: string }) => { acc[c.id] = c.name; return acc }, {})
        }
        const propTitleMap = (props || []).reduce((acc: Record<string,string>, p: Property)=>{ acc[p.id]=p.title; return acc }, {})

        const merged: AllRow[] = all.map(r => ({
          ...r,
          ...(propTitleMap[r.property_id] ? { property_title: propTitleMap[r.property_id] } : {}),
          ...(r.category_id && catNameMap[r.category_id] ? { category_name: catNameMap[r.category_id] } : {}),
          ...(vendorNameMap[r.vendor_id] ? { vendor_name: vendorNameMap[r.vendor_id] } : {}),
        }))
        setAllRows(merged)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
      } finally {
        setAllLoading(false)
      }
    }
    loadAll()
  }, [user])

  useEffect(() => {
    if (!user || !selectedProperty) { setRows([]); setVendorMap({}); return }
    const loadRows = async () => {
      try {
        setLoading(true)
        setError(null)
        // filter by property and optional category
        const dvQuery = supabase
          .from('dedicated_vendors')
          .select('id,property_id,category_id,vendor_id,priority,is_active')
          .eq('property_id', selectedProperty)
          .order('priority', { ascending: true })
        const dvRes = selectedCategory
          ? await dvQuery.eq('category_id', selectedCategory)
          : await dvQuery

        const dvRows = (dvRes.data || []) as DedicatedVendorRow[]
        setRows(dvRows)

        // hydrate vendor names via RPC get_profile_minimal (RLS-safe)
        const vendorIds = Array.from(new Set(dvRows.map(r => r.vendor_id)))
        if (vendorIds.length > 0) {
          const results = await Promise.all(vendorIds.map(async (vid) => {
            const res = await supabase.rpc('get_profile_minimal', { uid: vid })
            const row = Array.isArray(res.data) ? res.data[0] : res.data
            return row ? { id: row.id as string, full_name: (row.full_name as string) || '' } : { id: vid, full_name: '' }
          }))
          const map: Record<string, VendorProfile> = results.reduce((acc: Record<string, VendorProfile>, r) => { acc[r.id] = { id: r.id, full_name: r.full_name }; return acc }, {})
          setVendorMap(map)
        } else {
          setVendorMap({})
        }
      } catch (e) {
        setError('Failed to load dedicated vendors')
        // eslint-disable-next-line no-console
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    loadRows()
  }, [user, selectedProperty, selectedCategory])

  const categoriesForFilter = useMemo(() => categories, [categories])

  const handleToggleActive = async (row: DedicatedVendorRow) => {
    try {
      const { error: updErr } = await supabase
        .from('dedicated_vendors')
        .update({ is_active: !row.is_active })
        .eq('id', row.id)
      if (updErr) throw updErr
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: !r.is_active } : r))
      setAllRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: !r.is_active } as AllRow : r))
    } catch (e) {
      setError('Failed to update vendor status')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }

  const handleDelete = async (row: DedicatedVendorRow) => {
    try {
      const { error: delErr } = await supabase
        .from('dedicated_vendors')
        .delete()
        .eq('id', row.id)
      if (delErr) throw delErr
      setRows(prev => prev.filter(r => r.id !== row.id))
      setAllRows(prev => prev.filter(r => r.id !== row.id))
    } catch (e) {
      setError('Failed to remove vendor')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }

  // keep for UI button wiring; underscore to appease TS when temporarily unused
  const handleAdd = async () => {
    if (!selectedProperty || !newVendorId) { setError('Select a property and pick a vendor (use search).'); return }
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newVendorId)
      if (!isUuid) { setError('Vendor ID is not valid. Use the search below to pick a vendor.'); return }
      const payload = {
        property_id: selectedProperty,
        vendor_id: newVendorId,
        category_id: selectedCategory || null,
        priority: newPriority,
        is_active: true
      }
      const { data, error: insErr } = await supabase
        .from('dedicated_vendors')
        .insert(payload)
        .select('id,property_id,category_id,vendor_id,priority,is_active')
        .single()
      if (insErr) throw insErr
      setRows(prev => [data as DedicatedVendorRow, ...prev])
      setAllRows(prev => [{ ...(data as DedicatedVendorRow) } as AllRow, ...prev])
      setNewVendorId('')
      setNewPriority(1)
    } catch (e) {
      setError('Failed to add vendor. Ensure vendor exists and you own the property.')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }

  // Mark used to satisfy noUnusedLocals when UI wiring is conditional
  void handleAdd

  const handleAddVendorId = async (vendorId: string) => {
    if (!selectedProperty) { setError('Select a property first.'); return }
    try {
      const payload = {
        property_id: selectedProperty,
        vendor_id: vendorId,
        category_id: selectedCategory || null,
        priority: newPriority,
        is_active: true,
      }
      const { data, error: insErr } = await supabase
        .from('dedicated_vendors')
        .insert(payload)
        .select('id,property_id,category_id,vendor_id,priority,is_active')
        .single()
      if (insErr) throw insErr
      setRows(prev => [data as DedicatedVendorRow, ...prev])
      setAllRows(prev => [{ ...(data as DedicatedVendorRow) } as AllRow, ...prev])
      setVendorSearch('')
      setVendorResults([])
      setError(null)
    } catch (e) {
      setError('Failed to add vendor. Ensure vendor exists and you own the property.')
      // eslint-disable-next-line no-console
      console.error(e)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div className="max-w-sm mx-auto bg-white min-h-screen pb-20">
        <div className="px-4 py-4 flex items-center justify-between border-b">
          <h1 className="font-semibold text-gray-900">Dedicated Vendors</h1>
        </div>

        <div className="px-4 py-4 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* All Dedicated Vendors */}
          <div className="bg-white rounded-lg shadow">
            <button onClick={()=>setAllOpen(v=>!v)} className="w-full p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">All Dedicated Vendors ({allRows.length})</h3>
              <span className="text-gray-500 text-sm">{allOpen ? '▾' : '▸'}</span>
            </button>
            {allOpen && (
              <div className="p-3 space-y-2">
                {allLoading ? (
                  <div className="text-sm text-gray-500">Loading...</div>
                ) : allRows.length === 0 ? (
                  <div className="text-sm text-gray-500">No dedicated vendors found.</div>
                ) : (
                  allRows.map(r => (
                    <div key={r.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{r.vendor_name || r.vendor_id}</div>
                        <div className="text-xs text-gray-500">{r.property_title || r.property_id}{r.category_name ? ` • ${r.category_name}` : ''} • Priority {r.priority ?? 1}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={()=>handleToggleActive(r)} className={`px-3 py-1 rounded-full text-xs font-medium ${r.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{r.is_active ? 'Active' : 'Inactive'}</button>
                        <button onClick={()=>handleDelete(r)} className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Remove</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Filters & Manage */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Property *</label>
              <select
                value={selectedProperty}
                onChange={(e)=>setSelectedProperty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              >
                <option value="">Select property</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category (optional)</label>
              <select
                value={selectedCategory}
                onChange={(e)=>setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              >
                <option value="">All categories</option>
                {categoriesForFilter.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Add vendor */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="text-xs text-gray-600">Search and add a vendor. Category filter above will apply if set.</div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Priority</label>
                <input
                  type="number"
                  min={1}
                  value={newPriority}
                  onChange={(e)=>setNewPriority(parseInt(e.target.value || '1', 10))}
                  className="w-20 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                />
              </div>

              {/* Or search by name/email/phone */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-600 mb-2">Search vendors by name, email, or phone</div>
                <input
                  type="text"
                  value={vendorSearch}
                  onChange={(e)=>setVendorSearch(e.target.value)}
                  placeholder="Type at least 2 characters..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-500"
                />
                {vendorResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                    {vendorResults.map(r => (
                      <div key={r.id} className="flex items-center justify-between px-3 py-2">
                        <div>
                          <div className="font-medium text-gray-900">{r.name}</div>
                          <div className="text-xs text-gray-500">{r.email || ''}{r.phone ? (r.email ? ' • ' : '') + r.phone : ''}</div>
                        </div>
                        <button type="button" onClick={()=>handleAddVendorId(r.id)} className="text-xs bg-indigo-600 text-white px-2.5 py-1.5 rounded-md hover:bg-indigo-700">Add</button>
                      </div>
                    ))}
                  </div>
                )}
                {vendorResults.length === 0 && vendorSearch.trim().length >= 2 && (
                  <div className="mt-2 text-xs text-gray-500">No matches found.</div>
                )}
              </div>
            </div>

            {/* List */}
            <div className="space-y-2">
              {loading ? (
                <div className="text-sm text-gray-500">Loading...</div>
              ) : rows.length === 0 ? (
                <div className="text-sm text-gray-500">No dedicated vendors configured for this selection.</div>
              ) : (
                rows.map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{vendorMap[r.vendor_id]?.full_name || r.vendor_id}</div>
                      <div className="text-xs text-gray-500">Priority {r.priority ?? 1} {r.category_id ? '• Category scoped' : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={()=>handleToggleActive(r)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${r.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {r.is_active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={()=>handleDelete(r)}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <BottomNavbar userRole="owner" />
      </div>
    </ProtectedRoute>
  )
}

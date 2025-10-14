'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import BottomNavbar from '@/components/BottomNavbar'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'

type PropertyRow = {
  id: string
  owner_id: string
  title: string
  description: string | null
  address: string
  city: string
  province: string
  postal_code: string | null
  property_type: string
  bedrooms: number | null
  bathrooms: number | null
  parking_spaces: number | null
  rent_amount: number
  deposit_amount: number | null
  status: 'available' | 'occupied' | 'maintenance' | 'vacant' | null
  images: string[] | null
  created_at: string | null
}

const statusClasses: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  occupied: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-amber-100 text-amber-800',
  vacant: 'bg-slate-100 text-slate-800'
}

export default function OwnerPropertiesPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'available' | 'occupied' | 'maintenance' | 'vacant'>('all')
  const [sort, setSort] = useState<'newest' | 'rent_desc' | 'rent_asc'>('newest')

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('properties')
        .select('id, owner_id, title, description, address, city, province, postal_code, property_type, bedrooms, bathrooms, parking_spaces, rent_amount, deposit_amount, status, images, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        setError('Failed to load properties')
      } else {
        setProperties(data ?? [])
      }
      setLoading(false)
    }
    load()
  }, [user])

  const filtered = useMemo(() => {
    let result = properties
    if (q.trim()) {
      const t = q.trim().toLowerCase()
      result = result.filter(p =>
        p.title.toLowerCase().includes(t) ||
        p.address.toLowerCase().includes(t) ||
        p.city.toLowerCase().includes(t)
      )
    }
    if (status !== 'all') {
      result = result.filter(p => (p.status ?? 'available') === status)
    }
    switch (sort) {
      case 'rent_desc':
        result = [...result].sort((a,b) => (b.rent_amount ?? 0) - (a.rent_amount ?? 0))
        break
      case 'rent_asc':
        result = [...result].sort((a,b) => (a.rent_amount ?? 0) - (b.rent_amount ?? 0))
        break
      default:
        result = [...result].sort((a,b) => {
          const da = a.created_at ? new Date(a.created_at).getTime() : 0
          const db = b.created_at ? new Date(b.created_at).getTime() : 0
          return db - da
        })
    }
    return result
  }, [properties, q, status, sort])

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
            <h1 className="font-semibold text-gray-900">My Properties</h1>
          </div>
          <button
            data-testid="add-property"
            onClick={() => router.push('/dashboard/owner/properties/new')}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            + Add Property
          </button>
        </div>

        <div className="px-4 py-3 space-y-3">
          <input
            data-testid="search-input"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            placeholder="Search title, address, city"
            className="w-full border rounded-lg px-3 py-2 text-gray-900 placeholder-gray-600"
          />
          <div className="flex gap-2">
            <select data-testid="status-filter" value={status} onChange={(e)=>setStatus(e.target.value as any)} className="flex-1 border rounded-lg px-3 py-2 text-gray-900">
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
              <option value="vacant">Vacant</option>
            </select>
            <select data-testid="sort-select" value={sort} onChange={(e)=>setSort(e.target.value as any)} className="flex-1 border rounded-lg px-3 py-2 text-gray-900">
              <option value="newest">Newest</option>
              <option value="rent_desc">Rent: High to Low</option>
              <option value="rent_asc">Rent: Low to High</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="px-4 py-8 text-sm text-gray-600">Loading properties…</div>
        )}
        {error && (
          <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-t border-b">{error}</div>
        )}

        <div className="px-4 pb-4 space-y-3">
          {(!loading && filtered.length === 0) && (
            <div className="border rounded-lg p-4 bg-gray-50 text-center">
              <div className="text-gray-900 font-medium mb-1">No properties yet</div>
              <div className="text-sm text-gray-600 mb-3">Add your first property to start managing rent and maintenance.</div>
              <button
                onClick={() => router.push('/dashboard/owner/properties/new')}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                + Add Property
              </button>
            </div>
          )}
          {filtered.map(p => (
            <div key={p.id} data-testid={`property-card-${p.id}`} className="border rounded-lg overflow-hidden">
              <div className="h-28 bg-gray-100">
                {/* thumbnail strip */}
                {p.images && p.images.length > 0 ? (
                  <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${p.images[0]})` }} />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">No photos</div>
                )}
              </div>
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-gray-900">{p.title}</h2>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusClasses[p.status ?? 'available']}`}>{p.status ?? 'available'}</span>
                </div>
                <div className="text-sm text-gray-700">{p.address}, {p.city}, {p.province}</div>
                <div className="text-sm text-gray-900 font-semibold">R {Number(p.rent_amount).toLocaleString()}</div>
                <div className="flex gap-3 text-xs text-gray-600">
                  {p.bedrooms != null && <span>{p.bedrooms} bd</span>}
                  {p.bathrooms != null && <span>{p.bathrooms} ba</span>}
                  {p.parking_spaces != null && <span>{p.parking_spaces} parking</span>}
                </div>
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => router.push(`/dashboard/owner/properties/${p.id}`)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                  >View</button>
                  <button
                    data-testid={`edit-property-${p.id}`}
                    aria-label="Edit property"
                    onClick={() => router.push(`/dashboard/owner/properties/${p.id}/edit`)}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
                  >Edit</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <BottomNavbar userRole="owner" />
      </div>
    </ProtectedRoute>
  )
}



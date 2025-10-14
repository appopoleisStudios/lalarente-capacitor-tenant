'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase } from '@/lib/supabase'

type RequestRow = {
  id: string
  title: string
  description: string
  visibility: string | null
}

export default function EditMaintenanceRequestPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [request, setRequest] = useState<RequestRow | null>(null)
  const [visibility, setVisibility] = useState<'public' | 'invited'>('invited')

  useEffect(() => {
    const load = async () => {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        const { data, error } = await supabase
          .from('maintenance_requests')
          .select('id, title, description, visibility')
          .eq('id', id)
          .single()
        if (error) throw error
        setRequest(data as unknown as RequestRow)
        if ((data as any)?.visibility === 'public') setVisibility('public')
        else setVisibility('invited')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load request')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const save = async () => {
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase
        .from('maintenance_requests')
        .update({ visibility })
        .eq('id', id)
      if (error) throw error
      router.push(`/dashboard/owner/maintenance/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div className="max-w-sm mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Link href={`/dashboard/owner/maintenance/${id}`} className="text-blue-600 text-sm">Back</Link>
          <div className="text-lg font-bold">Edit Maintenance</div>
        </div>

        {loading && <div>Loading...</div>}
        {error && <div className="text-red-600 text-sm">{error}</div>}

        {!loading && !error && request && (
          <>
            <div className="bg-white rounded-lg border p-4 space-y-2">
              <div className="text-base font-semibold">{request.title}</div>
              <div className="text-sm text-gray-600">{request.description}</div>
            </div>

            <div className="bg-white rounded-lg border p-4 space-y-3">
              <div className="text-sm font-medium">Visibility</div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === 'public'}
                    onChange={() => setVisibility('public')}
                  />
                  Post to Open Market (public)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="visibility"
                    checked={visibility === 'invited'}
                    onChange={() => setVisibility('invited')}
                  />
                  Invite Closed Vendors (private)
                </label>
              </div>

              <button
                onClick={save}
                disabled={saving}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  )
}





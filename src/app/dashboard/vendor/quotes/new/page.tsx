'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase as client, UserRole } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'

function NewQuotePageInner() {
  const search = useSearchParams()
  const router = useRouter()
  const contractId = search.get('contract_id') || ''
  const [title, setTitle] = useState('')
  const [qty, setQty] = useState<number>(1)
  const [unitPrice, setUnitPrice] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Optional: fetch contract title
    const fetchTitle = async () => {
      if (!contractId) return
      const { data } = await client.from('service_contracts').select('title').eq('id', contractId).maybeSingle()
      setTitle(data?.title || '')
    }
    fetchTitle()
  }, [contractId])

  const submit = async () => {
    setLoading(true)
    setError(null)
    try {
      const sb = client
      // get current vendor_id
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: profile } = await sb.from('profiles').select('id').eq('id', user.id).maybeSingle()
      if (!profile) throw new Error('Profile not found')

      // fetch contract owner/property
      const { data: ctr } = await sb.from('service_contracts').select('owner_id,property_id').eq('id', contractId).maybeSingle()
      if (!ctr) throw new Error('Contract not found')

      const subtotal = qty * unitPrice
      const { data: q, error: qe } = await sb.from('quotes').insert({
        vendor_id: user.id,
        owner_id: ctr.owner_id,
        property_id: ctr.property_id,
        contract_id: contractId,
        status: 'submitted',
        subtotal,
        total_amount: subtotal
      }).select('id').maybeSingle()
      if (qe) throw qe
      if (!q) throw new Error('Failed to create quote')

      const { error: le } = await sb.from('quote_lines').insert({
        quote_id: q.id,
        description: title || 'Service',
        qty,
        unit_price: unitPrice,
        unit: 'job'
      })
      if (le) throw le

      router.push(`/contracts?id=${contractId}`)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to submit quote'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute allowedRoles={['vendor' as UserRole]}>
      <div className="p-4 max-w-lg mx-auto">
        <div className="mb-4 flex items-center gap-2">
          <Link href="/dashboard/vendor" className="text-blue-600 text-sm">Back</Link>
          <h1 className="font-semibold text-gray-900">Submit Quote</h1>
        </div>
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Line item title</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. AC servicing" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Quantity</label>
              <input type="number" min={1} value={qty} onChange={e=>setQty(parseFloat(e.target.value))} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Unit price (R)</label>
              <input type="number" min={0} value={unitPrice} onChange={e=>setUnitPrice(parseFloat(e.target.value))} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button disabled={loading || !contractId || !title || unitPrice<=0 || qty<=0} onClick={submit} className={`w-full ${loading? 'opacity-60': ''} bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium`}>
            {loading ? 'Submitting...' : 'Submit Quote'}
          </button>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export default function NewQuotePage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading…</div>}>
      <NewQuotePageInner />
    </Suspense>
  )
}



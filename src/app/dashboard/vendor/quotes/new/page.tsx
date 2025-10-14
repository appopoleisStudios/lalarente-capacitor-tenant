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
  const requestId = search.get('request_id') || ''
  const [title, setTitle] = useState('')
  const [qty, setQty] = useState<number>(1)
  const [unitPrice, setUnitPrice] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Optional: fetch title from contract or maintenance request
    const fetchTitle = async () => {
      if (contractId) {
        const { data } = await client.from('service_contracts').select('title').eq('id', contractId).maybeSingle()
        setTitle(data?.title || '')
      } else if (requestId) {
        const { data } = await client.from('maintenance_requests').select('title').eq('id', requestId).maybeSingle()
        setTitle(data?.title || '')
      }
    }
    fetchTitle()
  }, [contractId, requestId])

  const submit = async () => {
    setLoading(true)
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = client
      // get current vendor_id
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data: profile } = await sb.from('profiles').select('id').eq('id', user.id).maybeSingle()
      if (!profile) throw new Error('Profile not found')

      let owner_id: string
      let property_id: string

      if (contractId) {
        // Quote for existing service contract
        const { data: ctr } = await sb.from('service_contracts').select('owner_id,property_id').eq('id', contractId).maybeSingle()
        if (!ctr) throw new Error('Contract not found')
        owner_id = ctr.owner_id
        property_id = ctr.property_id
      } else if (requestId) {
        // Quote for maintenance request
        const { data: req } = await sb.from('maintenance_requests').select('owner_id,property_id').eq('id', requestId).maybeSingle()
        if (!req) throw new Error('Maintenance request not found')
        owner_id = (req as { owner_id: string }).owner_id
        property_id = (req as { property_id: string }).property_id
      } else {
        throw new Error('No contract or request ID provided')
      }

      const subtotal = qty * unitPrice
      const { data: q, error: qe } = await sb.from('quotes').insert({
        vendor_id: user.id,
        owner_id,
        property_id,
        contract_id: contractId || null,
        request_id: requestId || null,
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

      // Update vendor quote request status if this is for a maintenance request
      if (requestId) {
        await sb.from('vendor_quote_requests' as string)
          .update({ status: 'responded', responded_at: new Date().toISOString(), quote_id: q.id })
          .eq('request_id', requestId)
          .eq('vendor_id', user.id)
      }

      // Redirect based on context
      if (contractId) {
        router.push(`/contracts?id=${contractId}`)
      } else {
        router.push('/dashboard/vendor/jobs')
      }
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
            <label className="block text-sm text-gray-800 mb-1">Line item title</label>
            <input
              value={title}
              onChange={e=>setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm text-gray-900 placeholder-gray-500 bg-white"
              placeholder="e.g. AC servicing"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-800 mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={e=>setQty(parseFloat(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm text-gray-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-800 mb-1">Unit price (R)</label>
              <input
                type="number"
                min={0}
                value={unitPrice}
                onChange={e=>setUnitPrice(parseFloat(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm text-gray-900 bg-white"
                autoFocus={unitPrice <= 0}
              />
            </div>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button disabled={loading || (!contractId && !requestId) || !title || unitPrice<=0 || qty<=0} onClick={submit} className={`w-full ${loading? 'opacity-60': ''} bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium`}>
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



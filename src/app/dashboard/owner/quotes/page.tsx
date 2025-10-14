'use client'

import { useEffect, useState } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import Link from 'next/link'

type QuoteRow = {
	id: string
	status: string | null
	total_amount: number | null
	created_at: string | null
	property: { id: string; title: string | null } | null
	vendor: { id: string; full_name: string | null } | null
}

export default function OwnerQuotesPage() {
	const { user } = useAuthStore()
	const [loading, setLoading] = useState(true)
	const [quotes, setQuotes] = useState<QuoteRow[]>([])
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const load = async () => {
			if (!user) return
			setLoading(true)
			setError(null)
			try {
				const { data, error } = await (supabase as any)
					.from('quotes')
					.select(`id,status,total_amount,created_at,property:properties(id,title),vendor:profiles!quotes_vendor_id_fkey(id,full_name)`) // typed cast via any to avoid friction
					.eq('owner_id', user.id)
					.order('created_at', { ascending: false })
				if (error) throw error
				setQuotes(Array.isArray(data) ? data as QuoteRow[] : [])
			} catch (e) {
				setError(e instanceof Error ? e.message : 'Failed to load quotes')
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [user])

	return (
		<ProtectedRoute allowedRoles={['owner']}>
			<div className="max-w-sm mx-auto p-4 space-y-4">
				<div className="text-xl font-bold">Owner Quotes</div>
				{loading && <div>Loading...</div>}
				{error && <div className="text-red-600 text-sm">{error}</div>}
				{!loading && !error && (
					<div className="space-y-3">
						{quotes.length === 0 && (
							<div className="text-gray-600">No quotes yet.</div>
						)}
						{quotes.map((q) => (
							<Link key={q.id} href={`/dashboard/owner/quotes/${q.id}/review`} className="block bg-white rounded-lg border p-3 hover:bg-gray-50">
								<div className="flex justify-between text-sm">
									<div className="font-medium">{q.property?.title || 'Property'}</div>
									<div className="text-gray-600">{q.status || '—'}</div>
								</div>
								<div className="flex justify-between text-xs mt-1 text-gray-600">
									<div>Vendor: {q.vendor?.full_name || '—'}</div>
									<div>Total: {q.total_amount != null ? `R ${q.total_amount}` : '-'}</div>
								</div>
								<div className="text-xs text-gray-500 mt-1">{q.created_at ? new Date(q.created_at).toLocaleString('en-ZA') : ''}</div>
							</Link>
						))}
					</div>
				)}
			</div>
		</ProtectedRoute>
	)
}



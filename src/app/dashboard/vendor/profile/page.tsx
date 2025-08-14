'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Counts = { services: number; contracts: number }

export default function VendorProfilePage() {
	const { profile, signOut } = useAuthStore()
	const router = useRouter()
	const [counts, setCounts] = useState<Counts>({ services: 0, contracts: 0 })
	const [loading, setLoading] = useState(false)
	const [msg, setMsg] = useState('')

	useEffect(() => {
		const load = async () => {
			if (!profile?.id) return
			try {
				setLoading(true)
				const [{ count: svcCount }, { count: ctrCount }] = await Promise.all([
					supabase.from('vendor_services').select('*', { count: 'exact', head: true }).eq('vendor_id', profile.id),
					supabase.from('service_contracts').select('*', { count: 'exact', head: true }).eq('vendor_id', profile.id),
				])
				setCounts({ services: svcCount || 0, contracts: ctrCount || 0 })
			} catch (e) {
				setMsg(e instanceof Error ? e.message : 'Failed to load vendor stats')
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [profile?.id])

	const name = profile?.full_name || 'Vendor'
	const email = profile?.email || ''

	return (
		<ProtectedRoute allowedRoles={['vendor']}>
			<div className="max-w-sm mx-auto bg-white min-h-screen pb-20">
				<header className="px-4 py-4 border-b border-gray-200">
					<h1 className="text-lg font-bold text-gray-900">Profile</h1>
				</header>
				{msg && <div className="m-4 p-3 rounded border border-gray-200 bg-gray-50 text-gray-700">{msg}</div>}
				<main className="p-4 space-y-4">
					<div className="bg-white rounded-lg border p-4">
						<div className="flex items-center gap-3">
							<div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-semibold">{name.slice(0,2).toUpperCase()}</div>
							<div>
								<div className="text-gray-900 font-semibold">{name}</div>
								<div className="text-sm text-gray-600">{email}</div>
								<div className="text-xs text-indigo-700 bg-indigo-50 inline-block px-2 py-0.5 rounded-full mt-1">Vendor</div>
							</div>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="bg-white rounded-lg border p-4">
							<div className="text-sm text-gray-600">Services</div>
							<div className="text-2xl font-bold text-gray-900">{counts.services}</div>
						</div>
						<div className="bg-white rounded-lg border p-4">
							<div className="text-sm text-gray-600">Contracts</div>
							<div className="text-2xl font-bold text-gray-900">{counts.contracts}</div>
						</div>
					</div>

					<div className="bg-white rounded-lg border p-4">
						<h2 className="text-sm font-semibold text-gray-900 mb-3">Account</h2>
						<button
							onClick={async () => { await signOut(); router.push('/auth/login') }}
							className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium"
						>
							Sign out
						</button>
					</div>

					{loading && <div className="text-sm text-gray-500">Loading...</div>}
				</main>
			</div>
		</ProtectedRoute>
	)
}



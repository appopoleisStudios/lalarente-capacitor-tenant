'use client'

import { useAuthStore } from '@/store/authStore'

export default function VendorHeader() {
	const { profile } = useAuthStore()
	const name = profile?.full_name || 'Vendor'
	return (
		<header className="bg-white px-4 py-3 border-b border-gray-200">
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-2">
					<div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
						<span className="text-white font-bold text-sm">LR</span>
					</div>
					<div>
						<h1 className="text-lg font-bold text-gray-900">Lala Rente</h1>
						<span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Vendor</span>
					</div>
				</div>
				<div className="flex items-center space-x-3">
					<div className="relative">
						<button className="p-2 text-gray-600 hover:text-gray-900" aria-label="Notifications">
							<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5-5-5h5v-12"></path>
							</svg>
						</button>
						<span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">1</span>
					</div>
					<div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
						<span className="text-sm font-medium text-gray-700">{name.slice(0,2).toUpperCase()}</span>
					</div>
				</div>
			</div>
			<p className="text-sm text-gray-600 mt-1">Welcome back, {name}</p>
		</header>
	)
}



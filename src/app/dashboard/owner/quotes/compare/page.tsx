'use client'

import ProtectedRoute from '@/components/ProtectedRoute'

export default function OwnerQuotesComparePage() {
	return (
		<ProtectedRoute allowedRoles={['owner']}>
			<div className="max-w-sm mx-auto p-4 space-y-4">
				<div className="text-xl font-bold">Compare Quotes</div>
				<div className="text-gray-600">Side-by-side comparison (coming soon).</div>
			</div>
		</ProtectedRoute>
	)
}



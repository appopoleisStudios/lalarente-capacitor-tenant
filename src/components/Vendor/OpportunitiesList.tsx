'use client'

type Opportunity = {
	id: string
	title: string
	area?: string | null
	distance_km?: number | null
	est_budget?: number | null
}

export default function OpportunitiesList({ items, onQuote }: { items: Opportunity[]; onQuote: (id: string)=>void }) {
	return (
		<div className="bg-white rounded-lg shadow">
			<div className="p-4 border-b border-gray-100 flex items-center justify-between">
				<h3 className="font-semibold text-gray-900">New Job Opportunities</h3>
				<a href="#" className="text-blue-600 text-sm font-medium">See All</a>
			</div>
			<div className="divide-y divide-gray-100">
				{items.slice(0,2).map(op => (
					<div key={op.id} className="p-4">
						<div className="flex items-start justify-between mb-2">
							<div className="flex-1">
								<h4 className="font-medium text-gray-900">{op.title}</h4>
								<p className="text-sm text-gray-600">{op.area || ''}{op.distance_km ? ` • ${op.distance_km}km away` : ''}</p>
							</div>
							<span className="text-sm font-semibold text-emerald-600">{typeof op.est_budget==='number' ? `R ${op.est_budget.toLocaleString()}` : ''}</span>
						</div>
						<button onClick={()=> onQuote(op.id)} className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium text-sm">Submit Quote</button>
					</div>
				))}
				{items.length===0 && <div className="p-4 text-sm text-gray-500">No opportunities right now.</div>}
			</div>
		</div>
	)
}



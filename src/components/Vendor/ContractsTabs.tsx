'use client'

import Link from 'next/link'

export type VendorContractRow = {
	id: string
	title: string
	status: string
	property_label?: string
	total_amount?: number | null
	due_text?: string | null
  po_status?: 'po_issued' | 'none' | 'closed' | string
  exec_status?: 'not_started' | 'in_progress' | 'paused' | 'completed' | string | null
  quote_status?: 'requested' | 'submitted' | 'approved' | 'change_requested' | 'rejected' | string | null
}

function StatusPill({ status }: { status: string }) {
	const s = status.toLowerCase()
	if (s.includes('pending')) return <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full">Pending</span>
	if (s.includes('active')) return <span className="bg-emerald-600 text-white text-xs px-2 py-1 rounded-full">Active</span>
	if (s.includes('completed')) return <span className="bg-slate-300 text-slate-800 text-xs px-2 py-1 rounded-full">Completed</span>
	return <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">{status}</span>
}

export default function ContractsTabs({ pending, active, completed }: { pending: VendorContractRow[]; active: VendorContractRow[]; completed: VendorContractRow[] }) {
	return (
		<div className="bg-white rounded-lg shadow">
			<div className="p-4 border-b border-gray-100 flex items-center justify-between">
				<h3 className="font-semibold text-gray-900">Active Jobs</h3>
				<Link href="#" className="text-blue-600 text-sm font-medium">View All</Link>
			</div>
			<div className="divide-y divide-gray-100">
				{[...pending, ...active].slice(0,2).map((c)=> (
					<div className="p-4" key={c.id}>
						<div className="flex items-start justify-between mb-2">
							<div className="flex-1">
								<h4 className="font-medium text-gray-900">{c.title}</h4>
							</div>
							<StatusPill status={c.status} />
						</div>
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-4">
								<span className="text-sm font-semibold text-gray-900">{typeof c.total_amount==='number' ? `R ${c.total_amount.toLocaleString()}` : ''}</span>
								<span className="text-xs text-gray-500">{c.due_text || ''}</span>
							</div>
						<div className="flex items-center gap-2">
                {c.po_status && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.po_status==='po_issued' ? 'bg-indigo-50 text-indigo-700' : c.po_status==='closed' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{c.po_status==='po_issued' ? 'PO Issued' : c.po_status==='closed' ? 'PO Closed' : 'No PO'}</span>
                )}
                {c.exec_status && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.exec_status==='in_progress' ? 'bg-blue-50 text-blue-700' : c.exec_status==='completed' ? 'bg-emerald-50 text-emerald-700' : c.exec_status==='paused' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{c.exec_status==='in_progress' ? 'In Progress' : c.exec_status==='completed' ? 'Completed' : c.exec_status==='paused' ? 'Paused' : 'Not Started'}</span>
                )}
							{(() => {
								const needsQuote = c.quote_status === 'requested' || c.quote_status === 'change_requested'
								const href = needsQuote ? `/dashboard/vendor/quotes/new?contract_id=${c.id}` : `/contracts?id=${c.id}`
								const label = needsQuote ? 'Submit Quote' : 'View Details'
								return <Link href={href} className="bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-lg font-medium">{label}</Link>
							})()}
              </div>
						</div>
					</div>
				))}
				{pending.length + active.length === 0 && (
					<div className="p-4 text-sm text-gray-500">No active work yet.</div>
				)}
			</div>
		</div>
	)
}



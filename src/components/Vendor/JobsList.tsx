'use client'

import Link from 'next/link'
import type { VendorContractRow } from './ContractsTabs'

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s.includes('quote')) return <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full">{status}</span>
  if (s.includes('po')) return <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded-full">{status}</span>
  if (s.includes('progress')) return <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">{status}</span>
  if (s.includes('completed')) return <span className="bg-emerald-600 text-white text-xs px-2 py-1 rounded-full">Completed</span>
  if (s.includes('pending')) return <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full">Pending</span>
  return <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">{status}</span>
}

export default function JobsList({ rows }: { rows: VendorContractRow[] }) {
  if (!rows.length) return <div className="p-4 text-sm text-gray-500">No items.</div>
  return (
    <div className="divide-y divide-gray-100">
      {rows.map((c) => (
        <div className="p-4" key={c.id}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h4 className="font-medium text-gray-900">{c.title}</h4>
            </div>
            <StatusPill status={c.friendly_status || c.status} />
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
              {c.cta ? (
                <Link href={c.cta.href} className="bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-lg font-medium">{c.cta.label}</Link>
              ) : (
                <Link href={`/contracts?id=${c.id}`} className="bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-lg font-medium">View Details</Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}



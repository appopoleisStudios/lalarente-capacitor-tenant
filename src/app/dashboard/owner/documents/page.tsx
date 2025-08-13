'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function OwnerDocumentsPage() {
  const router = useRouter()
  const params = useSearchParams()
  const doc = (params.get('doc') || '').toLowerCase()

  const goContractsList = () => router.push('/dashboard/owner/contracts?filter=tenancy')
  const goContractsDetail = () => router.push('/contracts')
  const goNewContract = () => router.push('/dashboard/owner/contracts?filter=tenancy&new=tenancy')

  return (
    <ProtectedRoute allowedRoles={['owner']}>
      <div className="max-w-md mx-auto min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24">
        <div className="bg-white shadow-sm p-4 sticky top-0 z-10">
          <h1 className="text-xl font-bold text-gray-900">My Documents</h1>
          <p className="text-sm text-blue-700">Owner Documents Center</p>
        </div>

        <div className="p-4 space-y-4">
          {doc === 'lease' && (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">Lease Agreements</div>
              <button onClick={goContractsList} className="w-full bg-white border border-gray-200 rounded-lg p-3 text-left shadow-sm hover:border-blue-300">
                <div className="font-semibold text-gray-900">View Lease Contracts</div>
                <div className="text-xs text-gray-600">See pending signatures and sign</div>
              </button>
              <button onClick={goNewContract} className="w-full bg-white border border-gray-200 rounded-lg p-3 text-left shadow-sm hover:border-blue-300">
                <div className="font-semibold text-gray-900">Open New Contract</div>
                <div className="text-xs text-gray-600">Create a new tenancy agreement</div>
              </button>
              <button onClick={goContractsDetail} className="w-full bg-white border border-gray-200 rounded-lg p-3 text-left shadow-sm hover:border-blue-300">
                <div className="font-semibold text-gray-900">Open Contract Detail</div>
                <div className="text-xs text-gray-600">Paste a contract id with ?id= in the URL</div>
              </button>
            </div>
          )}

          {doc !== 'lease' && (
            <div className="text-sm text-gray-600">
              Select a document tile from your dashboard to view details. This section will be expanded soon.
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}



import type React from 'react'
interface Props { verified: boolean }
const VerificationStatus: React.FC<Props> = ({ verified }) => (
  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 mb-6">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center space-x-2">
        <i className="fas fa-shield-alt text-emerald-600"></i>
        <h3 className="font-semibold text-gray-800 text-sm">Account Status</h3>
      </div>
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${verified ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>
        {verified ? 'Verified' : 'Under Review'}
      </span>
    </div>
    <p className="text-xs text-gray-600">
      {verified
        ? 'Your account is verified and ready to apply for properties.'
        : 'We are reviewing your FICA documents. This typically takes 1-2 business days.'}
    </p>
  </div>
)
export default VerificationStatus

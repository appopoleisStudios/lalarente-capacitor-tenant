import { FC } from 'react'
interface Props { tenantName: string, propertyName: string }
const TenantHeader: FC<Props> = ({ tenantName, propertyName }) => (
  <div className="bg-white shadow-sm p-4 flex items-center justify-between">
    <div className="flex items-center space-x-3">
      <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center shadow">
        <i className="fas fa-user text-white text-xl"></i>
      </div>
      <div>
        <h1 className="text-lg font-bold text-gray-800 mb-0">Welcome back, {tenantName}!</h1>
        <p className="text-xs text-gray-400">Your current property:</p>
        <span className="text-sm text-emerald-700 font-medium">{propertyName}</span>
      </div>
    </div>
    <button className="p-2 relative rounded-full bg-gray-100 hover:bg-gray-200 transition">
      <i className="fas fa-bell text-gray-600"></i>
      <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
        <span className="text-xs font-bold text-white">2</span>
      </div>
    </button>
  </div>
)
export default TenantHeader

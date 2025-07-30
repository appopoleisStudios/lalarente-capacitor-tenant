import { FC } from 'react'

interface QuickAction {
  route: string
  label: string
  icon: string
  color: 'emerald' | 'orange' | 'blue' | 'purple'
  ariaLabel: string
}

interface Props {
  onNavigate: (route: string) => void
}

const quickActions: QuickAction[] = [
  { 
    route: '/properties/search', 
    label: 'Browse', 
    icon: 'fas fa-search', 
    color: 'emerald', 
    ariaLabel: 'Browse properties' 
  },
  { 
    route: '/tenant/maintenance/new', 
    label: 'New Maint.', 
    icon: 'fas fa-plus', 
    color: 'orange', 
    ariaLabel: 'Create new maintenance request' 
  },
  { 
    route: '/tenant/documents', 
    label: 'My Docs', 
    icon: 'fas fa-file-alt', 
    color: 'blue', 
    ariaLabel: 'View my documents' 
  },
  { 
    route: '/tenant/profile', 
    label: 'Profile', 
    icon: 'fas fa-user', 
    color: 'purple', 
    ariaLabel: 'View my profile' 
  },
]

const QuickActionsGrid: FC<Props> = ({ onNavigate }) => (
  <div className="grid grid-cols-4 gap-3 mb-8" role="navigation" aria-label="Quick actions">
    {quickActions.map((action) => (
      <button
        key={action.route}
        onClick={() => onNavigate(action.route)}
        aria-label={action.ariaLabel}
        className={`bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center hover:border-${action.color}-200 focus:outline-none focus:ring-2 focus:ring-${action.color}-500 focus:ring-offset-2 group transition-colors`}
      >
        <div className={`w-10 h-10 bg-${action.color}-100 rounded-full flex items-center justify-center mb-1 group-hover:bg-${action.color}-200 transition-colors`}>
          <i className={`${action.icon} text-${action.color}-600 text-lg`} aria-hidden="true"></i>
        </div>
        <span className="text-sm text-gray-700 font-medium">{action.label}</span>
      </button>
    ))}
  </div>
)
export default QuickActionsGrid

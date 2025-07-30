interface MaintenanceReq {
    title: string
    status: string
    detail: string
    icon: string
    color: string
    date: string
  }
  interface Props {
    activeRequests: MaintenanceReq[]
    onSeeAll: () => void
  }

  // Color mapping for predefined Tailwind classes
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    red: 'bg-red-100 text-red-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    orange: 'bg-orange-100 text-orange-600',
    purple: 'bg-purple-100 text-purple-600',
    pink: 'bg-pink-100 text-pink-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    gray: 'bg-gray-100 text-gray-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    teal: 'bg-teal-100 text-teal-600',
    cyan: 'bg-cyan-100 text-cyan-600',
    lime: 'bg-lime-100 text-lime-600',
    amber: 'bg-amber-100 text-amber-600',
    rose: 'bg-rose-100 text-rose-600',
    slate: 'bg-slate-100 text-slate-600',
    zinc: 'bg-zinc-100 text-zinc-600',
    neutral: 'bg-neutral-100 text-neutral-600',
    stone: 'bg-stone-100 text-stone-600'
  } as const

  const ActiveMaintenanceList: React.FC<Props> = ({ activeRequests, onSeeAll }) => {
    // Helper function to get color classes
    const getColorClasses = (color: string) => {
      const colorKey = color.toLowerCase() as keyof typeof colorClasses
      return colorClasses[colorKey] || colorClasses.gray // fallback to gray if color not found
    }

    return (
      <section className="mb-7" aria-labelledby="maintenance-heading">
        <div className="flex items-center mb-2 justify-between">
          <h3 id="maintenance-heading" className="text-base font-semibold text-gray-800">Active Maintenance</h3>
          <button 
            onClick={onSeeAll} 
            aria-label="View all maintenance requests"
            className="text-sm text-emerald-700 font-medium hover:text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 rounded px-2 py-1 transition-colors"
          >
            See All
          </button>
        </div>
        {activeRequests.length === 0 ? (
          <div className="text-gray-500 text-sm italic p-4 text-center" role="status" aria-live="polite">
            No active maintenance requests
          </div>
        ) : (
          <div className="space-y-2" role="list" aria-label="Active maintenance requests">
            {activeRequests.map((item, idx) => {
              const [bgClass, textClass] = getColorClasses(item.color).split(' ')
              return (
                <article 
                  key={`${item.title}-${idx}`} 
                  className="flex items-start bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                  role="listitem"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bgClass} mr-2 mt-0.5`} aria-hidden="true">
                    <i className={`${item.icon} ${textClass} text-base`}></i>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-sm text-gray-800">{item.title}</h4>
                      <span 
                        className={`ml-1 text-xs rounded px-2 py-0.5 font-medium ${item.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}
                        aria-label={`Status: ${item.status}`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{item.detail}</p>
                    <time className="text-xs text-gray-400 mt-1 block" dateTime={item.date}>
                      {item.date}
                    </time>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    )
  }
  export default ActiveMaintenanceList
  
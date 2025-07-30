interface Activity { text: string; date: string; icon: string; color: string; amount?: string; detail?: string }
interface Props { 
  recentActivity: Activity[]
  onSeeAll?: () => void
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

const RecentActivityFeed: React.FC<Props> = ({ recentActivity, onSeeAll }) => {
  // Helper function to get color classes
  const getColorClasses = (color: string) => {
    const colorKey = color.toLowerCase() as keyof typeof colorClasses
    return colorClasses[colorKey] || colorClasses.gray // fallback to gray if color not found
  }

  return (
  <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6" aria-labelledby="activity-heading">
    <div className="flex items-center justify-between mb-2">
      <h3 id="activity-heading" className="font-semibold text-gray-800">Recent Activity</h3>
      <button 
        onClick={onSeeAll}
        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 rounded px-2 py-1 transition-colors"
        aria-label="View all recent activity"
      >
        View All
      </button>
    </div>
    <div className="space-y-3" role="list" aria-label="Recent activity feed">
      {recentActivity.map((a, idx) => {
        const [bgClass, textClass] = getColorClasses(a.color).split(' ')
        return (
          <article key={`${a.text}-${idx}`} className="flex items-center space-x-3" role="listitem">
            <div className={`w-8 h-8 ${bgClass} rounded-full flex items-center justify-center`} aria-hidden="true">
              <i className={`${a.icon} ${textClass} text-base`}></i>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{a.text}</p>
              {a.amount && (
                <p className="text-sm text-gray-500">
                  {a.amount} {a.detail && <span className="text-gray-400">• {a.detail}</span>}
                </p>
              )}
            </div>
            <time className="text-sm text-gray-400" dateTime={a.date}>
              {a.date}
            </time>
          </article>
        )
      })}
    </div>
  </section>
  )
}
export default RecentActivityFeed

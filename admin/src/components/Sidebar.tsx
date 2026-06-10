import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊', adminOnly: false },
  { to: '/users', label: 'Users', icon: '👥', adminOnly: false },
  { to: '/properties', label: 'Properties', icon: '🏘️', adminOnly: false },
  { to: '/leases', label: 'Leases', icon: '📄', adminOnly: false },
  { to: '/maintenance', label: 'Maintenance', icon: '🔧', adminOnly: false },
  { to: '/payments', label: 'Payments', icon: '💰', adminOnly: false },
];

const devItems = [
  { to: '/dev/logs', label: 'Function Logs', icon: '📜' },
  { to: '/dev/audit', label: 'Audit Trail', icon: '🔍' },
  { to: '/dev/env', label: 'Environment', icon: '⚙️' },
];

const planeItem = { to: '/dev/plane', label: 'Plane Issues', icon: '🎯' };

export default function Sidebar() {
  const { profile, isDevAdmin, signOut } = useAuth();
  const { dark, toggle } = useTheme();

  return (
    <aside className="flex h-screen w-[--sidebar-width] flex-col border-r border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <span className="text-xl">🏠</span>
        <div>
          <h1 className="text-sm font-bold text-slate-900">LaLarente</h1>
          <p className="text-xs text-slate-500">Admin Panel</p>
        </div>
      </div>

      {/* Admin info */}
      <div className="border-b border-slate-100 px-5 py-3">
        <p className="text-xs font-medium text-slate-500">
          {profile?.full_name}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              isDevAdmin ? 'bg-amber-400' : 'bg-emerald-500'
            }`}
          />
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            {isDevAdmin ? 'Dev Admin' : 'Super Admin'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Platform
        </p>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }: { isActive: boolean }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        {isDevAdmin && (
          <>
            <p className="mb-2 mt-6 px-2 text-[11px] font-semibold uppercase tracking-widest text-amber-500">
              Dev Tools
            </p>
            <NavLink
              key={planeItem.to}
              to={planeItem.to}
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-50 text-amber-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <span className="text-base">{planeItem.icon}</span>
              {planeItem.label}
            </NavLink>
            {devItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }: { isActive: boolean }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-amber-50 text-amber-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Theme toggle + Sign out */}
      <div className="border-t border-slate-200 p-3 space-y-1">
        <button
          onClick={toggle}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="text-base">{dark ? '☀️' : '🌙'}</span>
          {dark ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <span className="text-base">🚪</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

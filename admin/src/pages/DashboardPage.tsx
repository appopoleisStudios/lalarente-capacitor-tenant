import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface DashboardStats {
  total_users: number;
  total_properties: number;
  total_leases: number;
  active_leases: number;
  maintenance_open: number;
  monthly_revenue: number;
  total_disputes: number;
  total_arrears: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data, error } = await supabase.rpc('admin_get_dashboard_stats');
        if (error) throw error;
        setStats(data as DashboardStats);
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Users',
      value: stats?.total_users.toLocaleString() ?? '—',
      icon: '👥',
      color: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Properties',
      value: stats?.total_properties.toLocaleString() ?? '—',
      icon: '🏘️',
      color: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Active Leases',
      value: stats?.active_leases.toLocaleString() ?? '—',
      icon: '📄',
      color: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Open Maintenance',
      value: stats?.maintenance_open.toLocaleString() ?? '—',
      icon: '🔧',
      color: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Monthly Revenue',
      value: `R ${(stats?.monthly_revenue ?? 0).toLocaleString()}`,
      icon: '💰',
      color: 'bg-green-50 text-green-700',
    },
    {
      label: 'Active Disputes',
      value: stats?.total_disputes.toLocaleString() ?? '—',
      icon: '⚖️',
      color: 'bg-red-50 text-red-700',
    },
    {
      label: 'Total Arrears',
      value: `R ${(stats?.total_arrears ?? 0).toLocaleString()}`,
      icon: '📉',
      color: 'bg-orange-50 text-orange-700',
    },
    {
      label: 'Total Leases',
      value: stats?.total_leases.toLocaleString() ?? '—',
      icon: '📋',
      color: 'bg-slate-50 text-slate-700',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Platform overview and key metrics
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">{card.icon}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${card.color}`}
              >
                Live
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold text-slate-900">
              {card.value}
            </p>
            <p className="mt-1 text-sm text-slate-500">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

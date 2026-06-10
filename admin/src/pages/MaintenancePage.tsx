import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface MaintenanceRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  estimated_cost: number | null;
  owner_name: string | null;
  tenant_name: string | null;
}

export default function MaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase.rpc('admin_get_maintenance');
      if (!error && data) setRequests(data as MaintenanceRow[]);
      setLoading(false);
    }
    fetch();
  }, []);

  const statusCounts = {
    total: requests.length,
    open: requests.filter(
      (r) => !['completed', 'cancelled'].includes(r.status ?? '')
    ).length,
    completed: requests.filter((r) => r.status === 'completed').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Maintenance</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track and manage maintenance requests
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-slate-900">{statusCounts.total}</p>
          <p className="text-sm text-slate-500">Total Requests</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-amber-600">{statusCounts.open}</p>
          <p className="text-sm text-slate-500">Open / In Progress</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-emerald-600">{statusCounts.completed}</p>
          <p className="text-sm text-slate-500">Completed</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600">Title</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Owner</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Tenant</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Priority</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Est. Cost</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Reported</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.title}</td>
                  <td className="px-4 py-3 text-slate-500">{r.owner_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{r.tenant_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.priority === 'critical'
                          ? 'bg-red-100 text-red-700'
                          : r.priority === 'high'
                            ? 'bg-orange-100 text-orange-700'
                            : r.priority === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {r.priority ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.status ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-900">
                    {r.estimated_cost ? `R ${r.estimated_cost.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(r.created_at).toLocaleDateString('en-ZA')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface LeaseRow {
  id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  status: string;
  deposit_amount: number | null;
  owner_name: string | null;
  tenant_name: string | null;
}

export default function LeasesPage() {
  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase.rpc('admin_get_leases');
      if (!error && data) setLeases(data as LeaseRow[]);
      setLoading(false);
    }
    fetch();
  }, []);

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
        <h1 className="text-2xl font-bold text-slate-900">Leases</h1>
        <p className="mt-1 text-sm text-slate-500">
          {leases.length} total leases — track status and terms
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600">Owner</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Tenant</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Rent</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Deposit</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Period</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leases.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{l.owner_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-900">{l.tenant_name ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    R {l.monthly_rent.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    R {l.deposit_amount?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        l.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : l.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : l.status === 'terminated'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(l.start_date).toLocaleDateString('en-ZA')} —{' '}
                    {new Date(l.end_date).toLocaleDateString('en-ZA')}
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

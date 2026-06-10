import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface PropertyRow {
  id: string;
  title: string;
  city: string;
  rent_amount: number | null;
  status: string;
  created_at: string;
  owner_name: string | null;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase.rpc('admin_get_properties');
      if (!error && data) setProperties(data as PropertyRow[]);
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
        <h1 className="text-2xl font-bold text-slate-900">Properties</h1>
        <p className="mt-1 text-sm text-slate-500">
          {properties.length} properties registered on the platform
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600">Title</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Owner</th>
                <th className="px-4 py-3 font-semibold text-slate-600">City</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Rent</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {properties.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.title}</td>
                  <td className="px-4 py-3 text-slate-500">{p.owner_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{p.city}</td>
                  <td className="px-4 py-3 text-slate-900">
                    R {p.rent_amount?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        p.status === 'available'
                          ? 'bg-emerald-100 text-emerald-700'
                          : p.status === 'rented'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(p.created_at).toLocaleDateString('en-ZA')}
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

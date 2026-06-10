import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface AuditEntry {
  created_at: string;
  source: 'maintenance' | 'inspection' | 'privacy' | 'contract';
  event: string;
  detail: string;
  actor_name: string | null;
  resource_id: string;
}

const sourceConfig: Record<string, { label: string; icon: string; color: string }> = {
  maintenance: { label: 'Maintenance', icon: '🔧', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  inspection:  { label: 'Inspection',  icon: '📋', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  privacy:     { label: 'Privacy',     icon: '🔒', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  contract:    { label: 'Contract',    icon: '📝', color: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export default function DevAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  async function fetchAudit(source?: string) {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_get_audit_trail', {
        p_limit: 200,
        p_source: source || null,
      });
      if (rpcError) throw rpcError;
      setEntries((data as AuditEntry[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit trail');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAudit();
  }, []);

  function handleReset() {
    setSourceFilter('');
    fetchAudit('');
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Audit Trail</h1>
        <p className="mt-1 text-sm text-slate-500">
          Unified activity feed across maintenance, inspections, privacy, and contracts
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Source
          </label>
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="">All sources</option>
            <option value="maintenance">Maintenance</option>
            <option value="inspection">Inspection</option>
            <option value="privacy">Privacy</option>
            <option value="contract">Contract</option>
          </select>
        </div>
        <button
          onClick={() => fetchAudit(sourceFilter || undefined)}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700"
        >
          Apply Filter
        </button>
        <button
          onClick={handleReset}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600" />
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">No audit entries found.</p>
        </div>
      )}

      {/* Audit feed */}
      {!loading && entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((entry, i) => {
            const cfg = sourceConfig[entry.source] ?? {
              label: entry.source,
              icon: '📄',
              color: 'bg-slate-50 text-slate-600 border-slate-200',
            };
            return (
              <div
                key={`${entry.source}-${entry.resource_id}-${i}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.color}`}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {entry.event}
                      </span>
                      <span className="text-xs text-slate-400">
                        by {entry.actor_name ?? 'system'}
                      </span>
                    </div>
                    {entry.detail && (
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-600 max-h-24 overflow-y-auto">
                        {entry.detail}
                      </pre>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(entry.created_at).toLocaleString('en-ZA')}
                      {' · '}
                      ID: {entry.resource_id}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

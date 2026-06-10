import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface LogEntry {
  id: string;
  source: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function DevLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchLogs(source?: string, level?: string) {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('dev_get_logs', {
        p_limit: 200,
        p_source: source || null,
        p_level: level || null,
      });
      if (rpcError) throw rpcError;
      setLogs((data as LogEntry[]) ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  function handleFilter() {
    fetchLogs(sourceFilter, levelFilter);
  }

  function handleReset() {
    setSourceFilter('');
    setLevelFilter('');
    fetchLogs('', '');
  }

  const levelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'warn':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Function Logs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Execution logs from edge functions and admin RPCs
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
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">All sources</option>
            <option value="accrue-deposit-interest">accrue-deposit-interest</option>
            <option value="auto-expire-viewings">auto-expire-viewings</option>
            <option value="lala-ai-chat">lala-ai-chat</option>
            <option value="admin_get_dashboard_stats">admin_get_dashboard_stats</option>
            <option value="admin_get_users">admin_get_users</option>
            <option value="admin_get_properties">admin_get_properties</option>
            <option value="admin_get_leases">admin_get_leases</option>
            <option value="admin_get_maintenance">admin_get_maintenance</option>
            <option value="admin_get_payment_stats">admin_get_payment_stats</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Level
          </label>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="">All levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
        <button
          onClick={handleFilter}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
        >
          Apply Filters
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

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
          <p className="text-sm text-slate-500">Total (filtered)</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-amber-600">
            {logs.filter((l) => l.level === 'warn').length}
          </p>
          <p className="text-sm text-slate-500">Warnings</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-red-600">
            {logs.filter((l) => l.level === 'error').length}
          </p>
          <p className="text-sm text-slate-500">Errors</p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-amber-600" />
        </div>
      )}

      {/* Log entries */}
      {!loading && logs.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">
            No logs found{sourceFilter || levelFilter ? ' for the selected filters' : ''}.
          </p>
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-300"
            >
              <button
                onClick={() =>
                  setExpandedId(expandedId === log.id ? null : log.id)
                }
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span
                  className={`inline-flex h-2 w-2 shrink-0 rounded-full ${
                    log.level === 'error'
                      ? 'bg-red-500'
                      : log.level === 'warn'
                        ? 'bg-amber-500'
                        : 'bg-slate-400'
                  }`}
                />
                <span
                  className={`inline-block shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${levelColor(log.level)}`}
                >
                  {log.level}
                </span>
                <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                  {log.source}
                </span>
                <span className="flex-1 truncate text-sm text-slate-900">
                  {log.message}
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {new Date(log.created_at).toLocaleString('en-ZA')}
                </span>
                <span className="shrink-0 text-slate-400">
                  {expandedId === log.id ? '▲' : '▼'}
                </span>
              </button>

              {expandedId === log.id && (
                <div className="border-t border-slate-100 px-4 py-3">
                  <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

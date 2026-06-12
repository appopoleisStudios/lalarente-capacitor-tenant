import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const PROJECT_REF = 'vvepwaolnkzfzhzgxlwr';

interface EdgeFnLog {
  id: string;
  timestamp: string;
  event_message: string;
  metadata?: {
    function_id?: string;
    execution_id?: string;
    level?: string;
    status?: number;
    method?: string;
  };
}

interface ParsedLog {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  status?: number;
  executionId?: string;
}

async function fetchEdgeLogs(product: string): Promise<ParsedLog[]> {
  const { data, error } = await supabase.functions.invoke('admin-proxy', {
    body: {
      target: 'supabase-mgmt',
      path: `v1/projects/${PROJECT_REF}/logs?product=${product}&limit=100`,
    },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);

  const raw: EdgeFnLog[] = data?.data ?? [];
  return raw.map((r) => ({
    id: r.id ?? r.timestamp,
    timestamp: r.timestamp,
    level: r.metadata?.level ?? 'info',
    message: r.event_message ?? '',
    status: r.metadata?.status,
    executionId: r.metadata?.execution_id,
  }));
}

const PRODUCTS = [
  { key: 'edge-functions', label: 'Edge Functions' },
  { key: 'auth',           label: 'Auth' },
  { key: 'storage',        label: 'Storage' },
  { key: 'realtime',       label: 'Realtime' },
];

export default function DevSupabasePage() {
  const [logs, setLogs] = useState<ParsedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState('edge-functions');

  async function load(p: string) {
    setLoading(true);
    setError(null);
    try {
      setLogs(await fetchEdgeLogs(p));
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(product); }, []);

  function handleProductChange(p: string) {
    setProduct(p);
    load(p);
  }

  const levelColor = (level: string) => {
    if (level === 'error') return 'bg-red-100 text-red-700';
    if (level === 'warning' || level === 'warn') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
  };

  const errorCount = logs.filter((l) => l.level === 'error').length;
  const warnCount  = logs.filter((l) => l.level === 'warning' || l.level === 'warn').length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Supabase Logs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Live logs from Supabase services — project {PROJECT_REF}
        </p>
      </div>

      {/* Product tabs */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {PRODUCTS.map((p) => (
          <button
            key={p.key}
            onClick={() => handleProductChange(p.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              product === p.key
                ? 'bg-emerald-600 text-white'
                : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => load(product)}
          className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
            <p className="text-sm text-slate-500">Total</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-amber-600">{warnCount}</p>
            <p className="text-sm text-slate-500">Warnings</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-red-600">{errorCount}</p>
            <p className="text-sm text-slate-500">Errors</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error.includes('SUPABASE_MGMT_TOKEN') ? (
            <>
              <strong>Supabase management token not configured.</strong> Run:
              <code className="ml-2 rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs">
                supabase secrets set SUPABASE_MGMT_TOKEN=&lt;your_token&gt; --project-ref vvepwaolnkzfzhzgxlwr
              </code>
              <p className="mt-1 text-xs text-red-400">Get your token at supabase.com → Account → Access Tokens</p>
            </>
          ) : error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
        </div>
      )}

      {!loading && !error && logs.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">No logs found for this service.</p>
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div className="space-y-1.5">
          {logs.map((log, i) => (
            <div
              key={`${log.id}-${i}`}
              className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white px-4 py-2.5 shadow-sm"
            >
              <span className={`mt-0.5 inline-block shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${levelColor(log.level)}`}>
                {log.level}
              </span>
              <span className="flex-1 font-mono text-xs text-slate-700 break-all">{log.message}</span>
              {log.status && (
                <span className={`shrink-0 text-xs font-medium ${log.status >= 400 ? 'text-red-500' : 'text-slate-400'}`}>
                  {log.status}
                </span>
              )}
              <span className="shrink-0 text-xs text-slate-400">
                {new Date(log.timestamp).toLocaleTimeString('en-ZA')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

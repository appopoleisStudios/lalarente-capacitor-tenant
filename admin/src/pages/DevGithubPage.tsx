import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface PullRequest {
  number: number;
  title: string;
  state: 'open' | 'closed';
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  user: { login: string; avatar_url: string };
  labels: { name: string; color: string }[];
  html_url: string;
  draft: boolean;
}

const REPO = 'repos/appopoleisStudios/lalarente-capacitor-tenant';

async function ghFetch(path: string) {
  const { data, error } = await supabase.functions.invoke('admin-proxy', {
    body: { target: 'github', path },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function DevGithubPage() {
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<'all' | 'open' | 'closed'>('all');

  async function load(state: 'all' | 'open' | 'closed') {
    setLoading(true);
    setError(null);
    try {
      const data = await ghFetch(`${REPO}/pulls?state=${state}&per_page=50&sort=updated&direction=desc`);
      setPrs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch pull requests');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(stateFilter); }, []);

  function handleFilterChange(s: 'all' | 'open' | 'closed') {
    setStateFilter(s);
    load(s);
  }

  function prStatus(pr: PullRequest) {
    if (pr.merged_at) return { label: 'Merged', cls: 'bg-violet-100 text-violet-700' };
    if (pr.state === 'closed') return { label: 'Closed', cls: 'bg-red-100 text-red-600' };
    if (pr.draft) return { label: 'Draft', cls: 'bg-slate-100 text-slate-500' };
    return { label: 'Open', cls: 'bg-emerald-100 text-emerald-700' };
  }

  const openCount   = prs.filter((p) => p.state === 'open' && !p.draft).length;
  const mergedCount = prs.filter((p) => p.merged_at).length;
  const draftCount  = prs.filter((p) => p.draft).length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">GitHub Pull Requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            appopoleisStudios / lalarente-capacitor-tenant
          </p>
        </div>
        <div className="flex gap-2">
          {(['all', 'open', 'closed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleFilterChange(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                stateFilter === s
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-emerald-600">{openCount}</p>
            <p className="text-sm text-slate-500">Open</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-violet-600">{mergedCount}</p>
            <p className="text-sm text-slate-500">Merged</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-slate-400">{draftCount}</p>
            <p className="text-sm text-slate-500">Draft</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error.includes('GITHUB_TOKEN') ? (
            <>
              <strong>GitHub token not configured.</strong> Run:
              <code className="ml-2 rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs">
                supabase secrets set GITHUB_TOKEN=&lt;your_pat&gt; --project-ref vvepwaolnkzfzhzgxlwr
              </code>
            </>
          ) : error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
        </div>
      )}

      {!loading && !error && prs.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-400">No pull requests found.</p>
        </div>
      )}

      {!loading && prs.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {prs.map((pr) => {
              const status = prStatus(pr);
              return (
                <a
                  key={pr.number}
                  href={pr.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <img
                    src={pr.user.avatar_url}
                    alt={pr.user.login}
                    className="mt-0.5 h-8 w-8 shrink-0 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${status.cls}`}>
                        {status.label}
                      </span>
                      <span className="font-medium text-slate-900 truncate">{pr.title}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-slate-400">#{pr.number} by {pr.user.login}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(pr.updated_at).toLocaleDateString('en-ZA')}
                      </span>
                      {pr.labels.map((l) => (
                        <span
                          key={l.name}
                          className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: `#${l.color}22`, color: `#${l.color}` }}
                        >
                          {l.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="shrink-0 text-slate-400 text-sm">↗</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

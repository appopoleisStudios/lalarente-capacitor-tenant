import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface SentryIssue {
  id: string;
  title: string;
  level: string;
  count: number;
  lastSeen: string;
}

export default function SentryErrorSummary() {
  const dsnSet = !!import.meta.env.VITE_SENTRY_DSN;
  const [issues, setIssues] = useState<SentryIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const org = import.meta.env.VITE_SENTRY_ORG;
  const project = import.meta.env.VITE_SENTRY_PROJECT;

  useEffect(() => {
    async function fetchIssues() {
      if (!org || !project) {
        setError('Sentry org/project not configured');
        setLoading(false);
        return;
      }
      try {
        const { data, error: fnError } = await supabase.functions.invoke('admin-proxy', {
          body: {
            target: 'sentry',
            path: `projects/${org}/${project}/issues/?statsPeriod=24h&limit=10&query=is:unresolved`,
          },
        });
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        const mapped: SentryIssue[] = (data ?? []).map((issue: any) => ({
          id: issue.id,
          title: issue.title ?? issue.metadata?.value ?? 'Unknown',
          level: issue.level,
          count: issue.count ?? 0,
          lastSeen: issue.lastSeen,
        }));
        setIssues(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch Sentry issues');
      } finally {
        setLoading(false);
      }
    }
    fetchIssues();
  }, [org, project]);

  const levelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-50';
      case 'fatal': return 'text-red-700 bg-red-100';
      case 'warning': return 'text-amber-600 bg-amber-50';
      default: return 'text-slate-600 bg-slate-100';
    }
  };

  function triggerTestError() {
    throw new Error('This is your first error!');
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Sentry Issues</h3>
        <span className="text-xs text-slate-400">Last 24h</span>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 mb-3">
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && issues.length === 0 && (
        <div className="text-center py-6">
          {dsnSet ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">No unresolved issues in the last 24h</p>
              <button
                onClick={triggerTestError}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
              >
                <span>💥</span>
                Break the world
              </button>
              <p className="text-xs text-slate-400">Click to send a test error</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Sentry crash reporting not configured</p>
          )}
        </div>
      )}

      {/* Issues list */}
      {!loading && issues.length > 0 && (
        <div className="space-y-2">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className="flex items-start gap-2 rounded-lg border border-slate-100 p-2.5 text-xs"
            >
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase ${levelColor(issue.level)}`}
              >
                {issue.level}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{issue.title}</p>
                <p className="mt-0.5 text-slate-400">
                  {issue.count} occurrences · {issue.lastSeen ? new Date(issue.lastSeen).toLocaleString('en-ZA') : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

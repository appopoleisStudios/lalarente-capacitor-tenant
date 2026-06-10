import { useEffect, useState } from 'react';

interface SentryEvent {
  id: string;
  message: string;
  level: string;
  count: number;
  lastSeen: string;
}

export default function SentryErrorSummary() {
  const [events, setEvents] = useState<SentryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSentryErrors() {
      try {
        // Sentry's API requires authentication via a token.
        // If no token is configured, show a message instead of failing.
        const token = import.meta.env.VITE_SENTRY_TOKEN;
        const org = import.meta.env.VITE_SENTRY_ORG;
        const project = import.meta.env.VITE_SENTRY_PROJECT;

        if (!token || !org || !project) {
          setError(null);
          setEvents([]);
          return;
        }

        const res = await fetch(
          `https://sentry.io/api/0/projects/${org}/${project}/issues/?statsPeriod=24h&limit=5&query=is:unresolved`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!res.ok) throw new Error(`Sentry API error: ${res.status}`);

        const data = await res.json();
        const mapped: SentryEvent[] = (data ?? []).map((issue: any) => ({
          id: issue.id,
          message: issue.title ?? issue.metadata?.value ?? 'Unknown',
          level: issue.level,
          count: issue.count ?? 0,
          lastSeen: issue.lastSeen,
        }));

        setEvents(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch Sentry data');
      } finally {
        setLoading(false);
      }
    }

    fetchSentryErrors();
  }, []);

  const levelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-50';
      case 'fatal': return 'text-red-700 bg-red-100';
      case 'warning': return 'text-amber-600 bg-amber-50';
      default: return 'text-slate-600 bg-slate-100';
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Sentry Errors</h3>
        <span className="text-xs text-slate-400">Last 24h</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="text-center py-6">
          <p className="text-sm text-slate-400">
            {import.meta.env.VITE_SENTRY_TOKEN
              ? 'No unresolved errors in the last 24h'
              : 'Configure VITE_SENTRY_TOKEN, VITE_SENTRY_ORG, and VITE_SENTRY_PROJECT to see errors'}
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="space-y-2">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-start gap-2 rounded-lg border border-slate-100 p-2.5 text-xs"
            >
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase ${levelColor(ev.level)}`}
              >
                {ev.level}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">
                  {ev.message}
                </p>
                <p className="mt-0.5 text-slate-400">
                  {ev.count} occurrences · {ev.lastSeen ? new Date(ev.lastSeen).toLocaleString('en-ZA') : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SentryErrorSummary() {
  const dsnSet = !!import.meta.env.VITE_SENTRY_DSN;
  const org = import.meta.env.VITE_SENTRY_ORG;
  const project = import.meta.env.VITE_SENTRY_PROJECT;
  const dashboardUrl = org && project
    ? `https://sentry.io/organizations/${org}/issues/?project=${project}&statsPeriod=24h`
    : 'https://sentry.io';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Sentry</h3>
        <span className={`inline-block h-2 w-2 rounded-full ${dsnSet ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      </div>

      <div className="space-y-2 text-sm">
        {/* Crash reporting status */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${dsnSet ? 'text-emerald-600' : 'text-slate-400'}`}>
            {dsnSet ? '● Crash reporting active' : '○ Crash reporting not configured'}
          </span>
        </div>

        {/* Dashboard link */}
        <a
          href={dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
        >
          <span>🔍</span>
          Open Sentry Dashboard
          <span className="text-blue-400">↗</span>
        </a>

        {/* Explanation */}
        <p className="text-xs text-slate-400 leading-relaxed pt-1">
          Sentry's API doesn't allow direct browser requests from external domains.
          Click above to view errors in the Sentry dashboard.
        </p>
      </div>
    </div>
  );
}

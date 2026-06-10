import { useState } from 'react';
import SentryErrorSummary from '../components/SentryErrorSummary';

interface EnvVar {
  key: string;
  value: string;
  source: 'vite' | 'runtime' | 'derived';
}

export default function DevEnvPage() {
  const [showValues, setShowValues] = useState(false);

  const envVars: EnvVar[] = [
    { key: 'VITE_SUPABASE_URL', value: import.meta.env.VITE_SUPABASE_URL ?? '(not set)', source: 'vite' },
    { key: 'VITE_SUPABASE_ANON_KEY', value: import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ set' : '(not set)', source: 'vite' },
    { key: 'VITE_SENTRY_DSN', value: import.meta.env.VITE_SENTRY_DSN ? '✓ set' : '(not set)', source: 'vite' },
    { key: 'VITE_SENTRY_TOKEN', value: import.meta.env.VITE_SENTRY_TOKEN ? '✓ set' : '(not set)', source: 'vite' },
    { key: 'VITE_SENTRY_ORG', value: import.meta.env.VITE_SENTRY_ORG ?? '(not set)', source: 'vite' },
    { key: 'VITE_SENTRY_PROJECT', value: import.meta.env.VITE_SENTRY_PROJECT ?? '(not set)', source: 'vite' },
    { key: 'VITE_PLANE_API_KEY', value: import.meta.env.VITE_PLANE_API_KEY ? '✓ set' : '(not set)', source: 'vite' },
    { key: 'VITE_PLANE_WORKSPACE_SLUG', value: import.meta.env.VITE_PLANE_WORKSPACE_SLUG ?? '(not set)', source: 'vite' },
    { key: 'VITE_PLANE_PROJECT_ID', value: import.meta.env.VITE_PLANE_PROJECT_ID ?? '(not set)', source: 'vite' },
    { key: 'MODE', value: import.meta.env.MODE, source: 'runtime' },
    { key: 'DEV', value: String(import.meta.env.DEV), source: 'runtime' },
    { key: 'PROD', value: String(import.meta.env.PROD), source: 'runtime' },
    { key: 'BASE_URL', value: import.meta.env.BASE_URL, source: 'runtime' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Environment</h1>
        <p className="mt-1 text-sm text-slate-500">
          View current environment configuration
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={showValues}
            onChange={() => setShowValues(!showValues)}
          />
          <div className="h-5 w-9 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-[var(--toggle-knob)] after:transition-all after:content-[''] peer-checked:bg-amber-500 peer-checked:after:translate-x-full" />
        </label>
        <span className="text-sm text-slate-600">Show values</span>
      </div>

      <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600">
                Variable
              </th>
              <th className="px-4 py-3 font-semibold text-slate-600">Value</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {envVars.map((v) => (
              <tr key={v.key} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-sm text-slate-900">
                  {v.key}
                </td>
                <td className="px-4 py-3 font-mono text-sm text-slate-500">
                  {showValues
                    ? v.value
                    : v.value.length > 8
                      ? '••••••••'
                      : v.value}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      v.source === 'vite'
                        ? 'bg-blue-100 text-blue-700'
                        : v.source === 'runtime'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {v.source}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sentry error summary widget */}
      <SentryErrorSummary />
    </div>
  );
}

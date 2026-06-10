import type { ReactNode } from 'react';

export interface Column<T> {
  /** Unique key for the column */
  key: string;
  /** Column header label */
  label: string;
  /** Render function for a cell */
  render: (item: T) => ReactNode;
  /** Optional CSS class for the header and cells */
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  /** Optional summary row below the table (e.g. counts) — rendered if provided */
  summary?: { label: string; value: string | number }[];
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyMessage = 'No data',
  summary,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-semibold text-slate-600 ${col.className ?? ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((item) => (
              <tr key={keyExtractor(item)} className="hover:bg-slate-50">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 ${col.className ?? ''}`}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {summary && summary.length > 0 && (
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                {summary.map((s) => (
                  <td
                    key={s.label}
                    className="px-4 py-3 text-sm font-medium text-slate-700"
                  >
                    {s.label}: {s.value}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

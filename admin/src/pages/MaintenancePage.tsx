import { useAdminData } from '../hooks/useAdminData';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import type { MaintenanceRow } from '../types/admin';

function PriorityBadge({ priority }: { priority: string }) {
  const color =
    priority === 'critical'
      ? 'bg-red-100 text-red-700'
      : priority === 'high'
        ? 'bg-orange-100 text-orange-700'
        : priority === 'medium'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {priority || '—'}
    </span>
  );
}

const columns: Column<MaintenanceRow>[] = [
  { key: 'title', label: 'Title', render: (r) => <span className="font-medium text-slate-900">{r.title}</span> },
  { key: 'owner', label: 'Owner', render: (r) => <span className="text-slate-500">{r.owner_name ?? '—'}</span> },
  { key: 'tenant', label: 'Tenant', render: (r) => <span className="text-slate-500">{r.tenant_name ?? '—'}</span> },
  { key: 'priority', label: 'Priority', render: (r) => <PriorityBadge priority={r.priority} /> },
  { key: 'status', label: 'Status', render: (r) => <span className="text-slate-500">{r.status ?? '—'}</span> },
  {
    key: 'cost',
    label: 'Est. Cost',
    render: (r) => (
      <span className="text-slate-900">{r.estimated_cost ? `R ${r.estimated_cost.toLocaleString()}` : '—'}</span>
    ),
  },
  {
    key: 'reported',
    label: 'Reported',
    className: 'text-xs text-slate-400',
    render: (r) => <>{new Date(r.created_at).toLocaleDateString('en-ZA')}</>,
  },
];

export default function MaintenancePage() {
  const { data: requests, loading } = useAdminData<MaintenanceRow[]>('admin_get_maintenance');

  const open = (requests ?? []).filter((r) => !['completed', 'cancelled'].includes(r.status ?? '')).length;
  const completed = (requests ?? []).filter((r) => r.status === 'completed').length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Maintenance</h1>
        <p className="mt-1 text-sm text-slate-500">Track and manage maintenance requests</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Total Requests', value: requests?.length ?? 0, color: 'text-slate-900' },
          { label: 'Open / In Progress', value: open, color: 'text-amber-600' },
          { label: 'Completed', value: completed, color: 'text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={requests ?? []}
        keyExtractor={(r) => r.id}
        loading={loading}
        emptyMessage="No maintenance requests found"
      />
    </div>
  );
}

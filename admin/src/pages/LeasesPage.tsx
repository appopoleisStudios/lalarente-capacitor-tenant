import { useAdminData } from '../hooks/useAdminData';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import type { LeaseRow } from '../types/admin';

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'active'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'pending'
        ? 'bg-amber-100 text-amber-700'
        : status === 'terminated'
          ? 'bg-red-100 text-red-700'
          : 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}

const columns: Column<LeaseRow>[] = [
  { key: 'owner', label: 'Owner', render: (l) => <span className="text-slate-900">{l.owner_name ?? '—'}</span> },
  { key: 'tenant', label: 'Tenant', render: (l) => <span className="text-slate-900">{l.tenant_name ?? '—'}</span> },
  {
    key: 'rent',
    label: 'Rent',
    render: (l) => <span className="font-medium text-slate-900">R {l.monthly_rent.toLocaleString()}</span>,
  },
  {
    key: 'deposit',
    label: 'Deposit',
    render: (l) => <span className="text-slate-500">R {l.deposit_amount?.toLocaleString() ?? '—'}</span>,
  },
  { key: 'status', label: 'Status', render: (l) => <StatusBadge status={l.status} /> },
  {
    key: 'period',
    label: 'Period',
    className: 'text-xs text-slate-400',
    render: (l) => (
      <>{new Date(l.start_date).toLocaleDateString('en-ZA')} — {new Date(l.end_date).toLocaleDateString('en-ZA')}</>
    ),
  },
];

export default function LeasesPage() {
  const { data: leases, loading } = useAdminData<LeaseRow[]>('admin_get_leases');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Leases</h1>
        <p className="mt-1 text-sm text-slate-500">
          {leases?.length ?? 0} total leases — track status and terms
        </p>
      </div>
      <DataTable
        columns={columns}
        data={leases ?? []}
        keyExtractor={(l) => l.id}
        loading={loading}
        emptyMessage="No leases found"
      />
    </div>
  );
}

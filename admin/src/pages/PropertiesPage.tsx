import { useAdminData } from '../hooks/useAdminData';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import type { PropertyRow } from '../types/admin';

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'available'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'rented'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}

const columns: Column<PropertyRow>[] = [
  { key: 'title', label: 'Title', render: (p) => <span className="font-medium text-slate-900">{p.title}</span> },
  { key: 'owner', label: 'Owner', render: (p) => <span className="text-slate-500">{p.owner_name ?? '—'}</span> },
  { key: 'city', label: 'City', render: (p) => <span className="text-slate-500">{p.city}</span> },
  {
    key: 'rent',
    label: 'Rent',
    render: (p) => <span className="text-slate-900">R {p.rent_amount?.toLocaleString() ?? '—'}</span>,
  },
  { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
  {
    key: 'added',
    label: 'Added',
    className: 'text-xs text-slate-400',
    render: (p) => <>{new Date(p.created_at).toLocaleDateString('en-ZA')}</>,
  },
];

export default function PropertiesPage() {
  const { data: properties, loading } = useAdminData<PropertyRow[]>('admin_get_properties');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Properties</h1>
        <p className="mt-1 text-sm text-slate-500">
          {properties?.length ?? 0} properties registered on the platform
        </p>
      </div>
      <DataTable
        columns={columns}
        data={properties ?? []}
        keyExtractor={(p) => p.id}
        loading={loading}
        emptyMessage="No properties found"
      />
    </div>
  );
}

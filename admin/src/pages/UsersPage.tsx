import { useState } from 'react';
import { useAdminData } from '../hooks/useAdminData';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import type { UserRow } from '../types/admin';
import { supabase } from '../lib/supabaseClient';

function RoleBadge({ role }: { role: string }) {
  const color =
    role === 'admin'
      ? 'bg-purple-100 text-purple-700'
      : role === 'owner'
        ? 'bg-blue-100 text-blue-700'
        : role === 'vendor'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-emerald-100 text-emerald-700';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {role}
    </span>
  );
}

export default function UsersPage() {
  const { data: users, loading, refetch } = useAdminData<UserRow[]>('admin_get_users');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function toggleDevAdmin(userId: string) {
    const { data, error } = await supabase.rpc('admin_toggle_dev_admin', { target_user_id: userId });
    if (error) {
      setActionMsg(`Error: ${error.message}`);
    } else {
      setActionMsg(`Dev admin ${data ? 'granted' : 'revoked'} successfully`);
      refetch();
    }
    setTimeout(() => setActionMsg(null), 3000);
  }

  const columns: Column<UserRow>[] = [
    { key: 'name', label: 'Name', render: (u) => <span className="font-medium text-slate-900">{u.full_name}</span> },
    { key: 'email', label: 'Email', render: (u) => <span className="text-slate-500">{u.email ?? '—'}</span> },
    { key: 'role', label: 'Role', render: (u) => <RoleBadge role={u.role} /> },
    {
      key: 'verified',
      label: 'Verified',
      render: (u) =>
        u.verification_status ? (
          <span className="text-emerald-600">✓ Verified</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'dev_admin',
      label: 'Dev Admin',
      render: (u) => (
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={u.dev_admin}
            onChange={() => toggleDevAdmin(u.id)}
          />
          <div className="h-5 w-9 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-500 peer-checked:after:translate-x-full" />
        </label>
      ),
    },
    {
      key: 'joined',
      label: 'Joined',
      className: 'text-xs text-slate-400',
      render: (u) => <>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-ZA') : '—'}</>,
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">{users?.length ?? 0} total users — manage access and roles</p>
      </div>

      {actionMsg && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{actionMsg}</div>
      )}

      <DataTable
        columns={columns}
        data={users ?? []}
        keyExtractor={(u) => u.id}
        loading={loading}
        emptyMessage="No users found"
      />
    </div>
  );
}

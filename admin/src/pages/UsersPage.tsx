import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UserRow {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  dev_admin: boolean;
  verification_status: boolean | null;
  created_at: string | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function fetchUsers() {
    const { data, error } = await supabase.rpc('admin_get_users');
    if (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } else {
      setUsers((data as UserRow[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function toggleDevAdmin(userId: string) {
    const { data, error } = await supabase.rpc('admin_toggle_dev_admin', {
      target_user_id: userId,
    });
    if (error) {
      setActionMsg(`Error: ${error.message}`);
    } else {
      setActionMsg(
        `Dev admin ${data ? 'granted' : 'revoked'} successfully`
      );
      fetchUsers();
    }
    setTimeout(() => setActionMsg(null), 3000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          {users.length} total users — manage access and roles
        </p>
      </div>

      {actionMsg && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {actionMsg}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Email</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Role</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Verified</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Dev Admin</th>
                <th className="px-4 py-3 font-semibold text-slate-600">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {user.full_name}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {user.email ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : user.role === 'owner'
                            ? 'bg-blue-100 text-blue-700'
                            : user.role === 'vendor'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.verification_status ? (
                      <span className="text-emerald-600">✓ Verified</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={user.dev_admin}
                        onChange={() => toggleDevAdmin(user.id)}
                      />
                      <div className="h-5 w-9 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-500 peer-checked:after:translate-x-full" />
                    </label>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString('en-ZA')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useAdminData } from '../hooks/useAdminData';
import type { PaymentStats } from '../types/admin';

export default function PaymentsPage() {
  const { data: stats, loading } = useAdminData<PaymentStats>('admin_get_payment_stats');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  const cards = [
    { label: 'Total Transactions', value: stats?.total_payments.toLocaleString() ?? '0', icon: '💳', color: 'bg-blue-50 text-blue-700' },
    { label: 'Successful Payments', value: stats?.paid_payments.toLocaleString() ?? '0', icon: '✅', color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Overdue Payments', value: stats?.overdue_payments.toLocaleString() ?? '0', icon: '⚠️', color: 'bg-red-50 text-red-700' },
    { label: 'Active Disputes', value: stats?.active_disputes.toLocaleString() ?? '0', icon: '⚖️', color: 'bg-amber-50 text-amber-700' },
    { label: 'Total Arrears Owed', value: `R ${(stats?.total_arrears ?? 0).toLocaleString()}`, icon: '📉', color: 'bg-orange-50 text-orange-700' },
    {
      label: 'Payment Success Rate',
      value: (stats?.total_payments ?? 0) > 0
        ? `${Math.round(((stats?.paid_payments ?? 0) / (stats?.total_payments ?? 1)) * 100)}%`
        : '—',
      icon: '📊',
      color: 'bg-violet-50 text-violet-700',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="mt-1 text-sm text-slate-500">Financial overview and transaction metrics</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-2xl">{s.icon}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.color}`}>Live</span>
            </div>
            <p className="mt-4 text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="mt-1 text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

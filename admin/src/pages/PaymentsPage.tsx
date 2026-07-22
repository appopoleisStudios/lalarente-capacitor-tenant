import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAdminData } from '../hooks/useAdminData';
import type { PaymentStats, VendorRevenueStats, VendorTransactionRow, VendorDisputeRow } from '../types/admin';

type Tab = 'rent' | 'vendor-revenue' | 'disputes';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'rent', label: 'Rent Payments', icon: '💰' },
  { key: 'vendor-revenue', label: 'Vendor Revenue', icon: '🛠️' },
  { key: 'disputes', label: 'Disputes', icon: '⚖️' },
];

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex cursor-help items-center">
      <svg
        className="h-3.5 w-3.5 text-slate-400 hover:text-slate-500 transition-colors"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM7.25 7a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0V7zm.75-2.5a1 1 0 100 2 1 1 0 000-2z"
          clipRule="evenodd"
        />
      </svg>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 rounded-lg bg-slate-800 text-xs text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-normal text-left leading-relaxed">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
      </div>
    </span>
  );
}

function Card({
  label,
  value,
  icon,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
  tooltip?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>Live</span>
      </div>
      <p className="mt-4 text-2xl font-bold text-slate-900">{value}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <p className="text-sm text-slate-500">{label}</p>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
    </div>
  );
}

// ─── Rent Payments Tab ──────────────────────────────────────────────────

function RentPaymentsTab() {
  const { data: stats, loading, error } = useAdminData<PaymentStats>('admin_get_payment_stats');

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;

  const cards = [
    {
      label: 'Total Transactions',
      value: stats?.total_payments.toLocaleString() ?? '0',
      icon: '💳',
      color: 'bg-blue-50 text-blue-700',
      tooltip: 'All tenant rent payments ever created on the platform, regardless of status — paid, pending, overdue, or failed. Each row in the payments table counts as one transaction.',
    },
    {
      label: 'Successful Payments',
      value: stats?.paid_payments.toLocaleString() ?? '0',
      icon: '✅',
      color: 'bg-emerald-50 text-emerald-700',
      tooltip: 'Tenant rent payments that were successfully completed and marked as paid.',
    },
    {
      label: 'Overdue Payments',
      value: stats?.overdue_payments.toLocaleString() ?? '0',
      icon: '⚠️',
      color: 'bg-red-50 text-red-700',
      tooltip: 'Rent payments past their due date that have not been paid yet. These represent active collection risk.',
    },
    {
      label: 'Active Disputes',
      value: stats?.active_disputes.toLocaleString() ?? '0',
      icon: '⚖️',
      color: 'bg-amber-50 text-amber-700',
      tooltip: 'Payment disputes raised by tenants that are still open or under review. Resolved/rejected disputes are excluded.',
    },
    {
      label: 'Total Arrears Owed',
      value: `R ${(stats?.total_arrears ?? 0).toLocaleString()}`,
      icon: '📉',
      color: 'bg-orange-50 text-orange-700',
      tooltip: 'Sum of all outstanding arrears across every tenant where the escalation has not yet been resolved. This is the total amount in the arrears escalation pipeline.',
    },
    {
      label: 'Payment Success Rate',
      value: (stats?.total_payments ?? 0) > 0
        ? `${Math.round(((stats?.paid_payments ?? 0) / (stats?.total_payments ?? 1)) * 100)}%`
        : '—',
      icon: '📊',
      color: 'bg-violet-50 text-violet-700',
      tooltip: 'Percentage of all rent payments that were successfully paid. Calculated as (successful payments ÷ total transactions) × 100.',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((s) => <Card key={s.label} {...s} />)}
    </div>
  );
}

// ─── Vendor Revenue Tab ─────────────────────────────────────────────────

function VendorRevenueTab() {
  const { data: stats, loading, error } = useAdminData<VendorRevenueStats>('admin_get_vendor_revenue_summary');
  const { data: transactions, loading: txLoading, error: txError } = useAdminData<VendorTransactionRow[]>('admin_get_vendor_transactions');

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;

  const cards = [
    {
      label: 'Gross Collected',
      value: `R ${(stats?.gross_collected ?? 0).toLocaleString()}`,
      icon: '💰',
      color: 'bg-emerald-50 text-emerald-700',
      tooltip: 'Total amount collected from all completed vendor payments before any deductions. This is what was charged to tenants/owners for vendor services.',
    },
    {
      label: 'Platform Fees',
      value: `R ${(stats?.platform_fees ?? 0).toLocaleString()}`,
      icon: '📈',
      color: 'bg-blue-50 text-blue-700',
      tooltip: 'Total platform commission earned from completed vendor payments. This is the platform\'s revenue before gateway processing fees.',
    },
    {
      label: 'Net Revenue',
      value: `R ${(stats?.net_revenue ?? 0).toLocaleString()}`,
      icon: '📊',
      color: 'bg-violet-50 text-violet-700',
      tooltip: 'Platform revenue after deducting payment gateway processing fees. Calculated as platform_fees minus gateway_fees.',
    },
    {
      label: 'Pending Payouts',
      value: `R ${(stats?.pending_payouts_total ?? 0).toLocaleString()}`,
      icon: '⏳',
      color: 'bg-amber-50 text-amber-700',
      tooltip: 'Total amount that has been collected from customers but not yet paid out to vendors. Payments are completed but payout status is pending or processing.',
    },
    {
      label: '30d Revenue',
      value: `R ${(stats?.revenue_30d ?? 0).toLocaleString()}`,
      icon: '📅',
      color: 'bg-indigo-50 text-indigo-700',
      tooltip: 'Net platform revenue generated from vendor payments in the last 30 days. Useful for month-over-month comparison.',
    },
    {
      label: '7d Revenue',
      value: `R ${(stats?.revenue_7d ?? 0).toLocaleString()}`,
      icon: '🔥',
      color: 'bg-orange-50 text-orange-700',
      tooltip: 'Net platform revenue generated from vendor payments in the last 7 days. A quick pulse check on recent business activity.',
    },
    {
      label: 'Completed',
      value: (stats?.completed_count ?? 0).toLocaleString(),
      icon: '✅',
      color: 'bg-emerald-50 text-emerald-700',
      tooltip: 'Number of vendor payments that have been fully completed — payment collected and processed successfully.',
    },
    {
      label: 'Active Disputes',
      value: (stats?.active_disputes ?? 0).toLocaleString(),
      icon: '⚖️',
      color: 'bg-red-50 text-red-700',
      tooltip: 'Vendor payment disputes that are currently opened or escalated. These require admin review and resolution.',
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((s) => <Card key={s.label} {...s} />)}
      </div>

      {/* Recent transactions */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Recent Transactions</h2>
        {txLoading ? (
          <LoadingSpinner />
        ) : txError ? (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{txError}</div>
        ) : !transactions || transactions.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-400">No vendor payment transactions yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-600">Invoice</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Vendor</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Job</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Amount</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Fee</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Net</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{tx.invoice_number || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{tx.vendor_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{tx.maintenance_title || '—'}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">R {tx.total_amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">R {tx.platform_fee.toLocaleString()}</td>
                      <td className="px-4 py-3 text-emerald-600 font-medium">R {(tx.net_revenue ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          tx.payment_status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          tx.payment_status === 'failed' ? 'bg-red-100 text-red-700' :
                          tx.payment_status === 'processing' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{tx.payment_status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {tx.paid_at ? new Date(tx.paid_at).toLocaleDateString('en-ZA') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick link to vendor payouts */}
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            <strong>Payouts:</strong>{' '}
            <a href="/vendor-payouts" className="font-medium underline hover:text-amber-900">
              Manage vendor payouts →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Disputes Tab ────────────────────────────────────────────────────────

function DisputesTab() {
  const { data: disputes, loading, error, refetch } = useAdminData<VendorDisputeRow[]>('admin_get_vendor_disputes');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (paymentId: string, action: 'resolve' | 'escalate') => {
    setActionLoading(paymentId);
    try {
      const { error: rpcError } = await supabase.rpc('admin_resolve_vendor_dispute', {
        p_payment_id: paymentId,
        p_action: action,
      });
      if (rpcError) throw rpcError;
      refetch();
    } catch (err: any) {
      alert(`Failed to ${action} dispute: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Vendor Payment Disputes</h2>
          <p className="text-sm text-slate-500">Resolve or escalate disputed vendor payments</p>
        </div>
        <button onClick={refetch} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50">
          ↻ Refresh
        </button>
      </div>

      {!disputes || disputes.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-sm font-medium text-slate-900">No active disputes</p>
          <p className="mt-1 text-sm text-slate-400">All vendor payments are in good standing.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      d.dispute_status === 'opened' ? 'bg-red-100 text-red-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>{d.dispute_status}</span>
                    <span className="text-xs text-slate-400">{d.invoice_number || '—'}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900">{d.maintenance_title || 'Unknown job'}</p>
                  <p className="text-xs text-slate-500">Vendor: {d.vendor_name || 'Unknown'} · Tenant: {d.tenant_name || 'Unknown'}</p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-lg font-bold text-slate-900">R {d.total_amount.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Payout: R {d.vendor_payout.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Created: {new Date(d.created_at).toLocaleDateString('en-ZA')}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => handleAction(d.id, 'resolve')}
                  disabled={actionLoading === d.id}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
                >
                  {actionLoading === d.id ? '...' : '✓ Resolve'}
                </button>
                {d.dispute_status !== 'escalated' && (
                  <button
                    onClick={() => handleAction(d.id, 'escalate')}
                    disabled={actionLoading === d.id}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-40"
                  >
                    {actionLoading === d.id ? '...' : '⬆ Escalate'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('rent');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="mt-1 text-sm text-slate-500">Financial overview and transaction metrics</p>
      </div>

      {/* Tab navigation */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-6" aria-label="Payment tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`panel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
            >
              <span aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div
        id="panel-rent"
        role="tabpanel"
        aria-labelledby="tab-rent"
        hidden={activeTab !== 'rent'}
      >
        {activeTab === 'rent' && <RentPaymentsTab />}
      </div>
      <div
        id="panel-vendor-revenue"
        role="tabpanel"
        aria-labelledby="tab-vendor-revenue"
        hidden={activeTab !== 'vendor-revenue'}
      >
        {activeTab === 'vendor-revenue' && <VendorRevenueTab />}
      </div>
      <div
        id="panel-disputes"
        role="tabpanel"
        aria-labelledby="tab-disputes"
        hidden={activeTab !== 'disputes'}
      >
        {activeTab === 'disputes' && <DisputesTab />}
      </div>
    </div>
  );
}

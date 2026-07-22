import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

interface PayoutRow {
  id: string;
  invoice_number: string | null;
  maintenance_title: string | null;
  vendor_name: string;
  total_amount: number;
  platform_fee: number;
  payout_fee: number;
  vendor_payout: number;
  payout_status: string;
  payout_method: string;
  payout_reference: string | null;
  payout_initiated_at: string | null;
  payout_completed_at: string | null;
  paid_at: string | null;
  created_at: string;
}

interface VendorGroup {
  vendor_id: string;
  business_name: string | null;
  full_name: string;
  email: string | null;
  payouts: PayoutRow[];
  total_owed: number;
  count: number;
}

interface PayoutsResponse {
  pending_count: number;
  processing_count: number;
  failed_count: number;
  total_count: number;
  amount_owed: number;
  total_amount: number;
  by_vendor: VendorGroup[];
  payouts: PayoutRow[];
}

async function invokeEdge<T>(fn: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke(fn, {
    method,
    body: body || undefined,
  });

  if (error) throw new Error(error.message || `Failed to invoke ${fn}`);
  return data as T;
}

function StatusBadge({ status }: { status: string }) {
  const color: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    processing: 'bg-blue-100 text-blue-700',
    sent: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
    on_hold: 'bg-purple-100 text-purple-700',
    cancelled: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export default function VendorPayoutsPage() {
  const [data, setData] = useState<PayoutsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showMarkSent, setShowMarkSent] = useState<string | null>(null);
  const [sentRef, setSentRef] = useState('');
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invokeEdge<PayoutsResponse>('process-vendor-payouts', 'GET');
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load pending payouts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const handleBatchProcess = async () => {
    if (!data || data.payouts.length === 0) return;
    if (!window.confirm(`Initiate batch processing for ${data.payouts.filter(p => p.payout_status === 'pending').length} pending payout(s)? This will mark them as processing for manual EFT.`)) return;
    setProcessing(true);
    setSuccessMsg(null);
    try {
      const result = await invokeEdge<{ processed_count: number; error_count: number }>(
        'process-vendor-payouts',
        'POST',
        { method: 'manual_eft' }
      );
      setSuccessMsg(`Batch processing complete: ${result.processed_count} payouts initiated.`);
      await fetchPayouts();
    } catch (err: any) {
      setError(err.message || 'Batch processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkSent = async (paymentId: string) => {
    if (!sentRef.trim()) return;
    setSending(true);
    setSuccessMsg(null);
    try {
      await invokeEdge<{ success: boolean }>(
        'admin-mark-payout-sent',
        'POST',
        { payment_id: paymentId, reference: sentRef.trim() }
      );
      setSuccessMsg(`Payout ${paymentId.slice(0, 8)}... marked as sent.`);
      setShowMarkSent(null);
      setSentRef('');
      await fetchPayouts();
    } catch (err: any) {
      setError(err.message || 'Failed to mark payout as sent');
    } finally {
      setSending(false);
    }
  };

  // Summary stats from server-side status-split response
  const pendingCount = data?.pending_count ?? 0;
  const processingCount = data?.processing_count ?? 0;
  const failedCount = data?.failed_count ?? 0;
  const amountOwed = data?.amount_owed ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendor Payouts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage manual EFT payouts to vendors
          </p>
        </div>
        <button
          onClick={fetchPayouts}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMsg}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Awaiting Initiation', value: pendingCount, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'In Progress', value: processingCount, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Amount Owed', value: `R ${amountOwed.toLocaleString()}`, color: 'text-slate-900', bg: 'bg-slate-50' },
          { label: 'Failed', value: failedCount, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border border-slate-200 p-5 shadow-sm ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Batch process button */}
      {pendingCount > 0 && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div>
            <p className="text-sm font-semibold text-amber-800">Pending Payouts</p>
            <p className="text-xs text-amber-600">
              {pendingCount} payout{pendingCount !== 1 ? 's' : ''} awaiting initiation.
              Mark them as processing to begin manual EFT.
            </p>
          </div>
          <button
            onClick={handleBatchProcess}
            disabled={processing}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing ? 'Processing...' : 'Initiate Batch'}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && data && data.total_count === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-sm font-medium text-slate-900">All caught up!</p>
          <p className="mt-1 text-sm text-slate-400">No pending vendor payouts.</p>
        </div>
      )}

      {/* Grouped by vendor */}
      {!loading && data && data.by_vendor.length > 0 && (
        <div className="space-y-6">
          {data.by_vendor.map((group) => (
            <div key={group.vendor_id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {/* Vendor header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {group.business_name || group.full_name}
                  </p>
                  {group.email && (
                    <p className="text-xs text-slate-400">{group.email}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    R {group.total_owed.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400">{group.count} payout{group.count !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Payout rows */}
              <div className="divide-y divide-slate-50">
                {group.payouts.map((payout) => (
                  <div key={payout.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={payout.payout_status} />
                          <span className="text-xs text-slate-400">
                            {payout.invoice_number || '—'}
                          </span>
                        </div>
                        {payout.maintenance_title && (
                          <p className="mt-1 text-xs text-slate-500">{payout.maintenance_title}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          R {payout.vendor_payout.toLocaleString()}
                        </p>
                        {payout.payout_reference && (
                          <p className="text-xs text-slate-400">Ref: {payout.payout_reference}</p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-2 flex items-center justify-end gap-2">
                      {payout.payout_status === 'processing' && (
                        <>
                          {showMarkSent === payout.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={sentRef}
                                onChange={(e) => setSentRef(e.target.value)}
                                placeholder="EFT reference"
                                className="w-48 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs shadow-sm focus:border-blue-400 focus:outline-none"
                              />
                              <button
                                onClick={() => handleMarkSent(payout.id)}
                                disabled={sending || !sentRef.trim()}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {sending ? '...' : 'Confirm Sent'}
                              </button>
                              <button
                                onClick={() => { setShowMarkSent(null); setSentRef(''); }}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setShowMarkSent(payout.id); setSentRef(''); }}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                            >
                              Mark Sent
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import type { VendorTransactionDetail } from '../types/admin';
import { EVIDENCE_STAGE_LABELS, EVIDENCE_EVENT_LABELS } from '../lib/evidenceLabels';

const fmtRand = (n: number | null | undefined) =>
  `R${(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/**
 * Drill-down modal for a single vendor payment: full financial breakdown,
 * immutable ledger journal, and photo evidence timeline.
 */
export default function TransactionDetailModal({
  detail,
  loading,
  error,
  onClose,
}: {
  detail: VendorTransactionDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  // Don't render the full-screen overlay at all until there is something to show.
  if (!detail && !loading && !error) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Transaction detail"
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {detail?.invoice_number || 'Transaction'}
            </h2>
            <p className="text-xs text-slate-400">
              {detail?.maintenance_title || '—'} · {detail?.vendor_name || 'Vendor'} →{' '}
              {detail?.tenant_name || 'Tenant'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50"
          >
            ✕ Close
          </button>
        </div>

        <div className="px-6 py-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          {!detail && !loading && !error && (
            <div className="py-12 text-center text-sm text-slate-400">
              Select a transaction to view details.
            </div>
          )}

          {detail && !loading && !error && (
            <div className="space-y-6">
              {/* Financial breakdown */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    label: 'Total Amount',
                    value: fmtRand(detail.total_amount),
                    cls: 'text-slate-900',
                  },
                  {
                    label: 'Platform Fee',
                    value: fmtRand(detail.platform_fee),
                    cls: 'text-blue-600',
                  },
                  {
                    label: 'Gateway Fee',
                    value: fmtRand(detail.gateway_fee),
                    cls: 'text-slate-500',
                  },
                  {
                    label: 'Net Revenue',
                    value: fmtRand(detail.net_revenue),
                    cls: 'text-emerald-600',
                  },
                  {
                    label: 'Vendor Payout',
                    value: fmtRand(detail.vendor_payout),
                    cls: 'text-slate-900',
                  },
                  { label: 'Payout Fee', value: fmtRand(detail.payout_fee), cls: 'text-slate-500' },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
                  >
                    <p className={`text-sm font-bold ${s.cls}`}>{s.value}</p>
                    <p className="text-[11px] text-slate-400">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Status strip */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
                  payment: {detail.payment_status}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
                  payout: {detail.payout_status}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
                  dispute: {detail.dispute_status}
                </span>
                {detail.payout_method && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
                    {detail.payout_method}
                  </span>
                )}
                {detail.gateway_transaction_id && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-blue-600">
                    txn {detail.gateway_transaction_id.slice(0, 12)}…
                  </span>
                )}
              </div>

              {/* Key dates */}
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                {[
                  { label: 'Created', value: fmtDate(detail.created_at) },
                  { label: 'Paid', value: fmtDate(detail.paid_at) },
                  { label: 'Payout initiated', value: fmtDate(detail.payout_initiated_at) },
                  { label: 'Payout completed', value: fmtDate(detail.payout_completed_at) },
                  { label: 'Payout reference', value: detail.payout_reference || '—' },
                ].map((r) => (
                  <div key={r.label}>
                    <p className="font-medium text-slate-500">{r.label}</p>
                    <p className="text-slate-700">{r.value}</p>
                  </div>
                ))}
              </div>

              {/* Ledger journal */}
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">Ledger Journal</h3>
                {detail.ledger.length === 0 ? (
                  <p className="text-xs text-slate-400">No ledger entries for this payment.</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 font-semibold text-slate-600">Entry</th>
                          <th className="px-3 py-2 font-semibold text-slate-600">Amount</th>
                          <th className="px-3 py-2 font-semibold text-slate-600">Balance</th>
                          <th className="px-3 py-2 font-semibold text-slate-600">When</th>
                          <th className="px-3 py-2 font-semibold text-slate-600">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.ledger.map((e) => (
                          <tr key={`${e.entry_type}-${e.created_at}`} className="hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <span
                                className={`rounded-full px-2 py-0.5 font-medium ${
                                  e.amount >= 0
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {e.entry_type}
                              </span>
                            </td>
                            <td
                              className={`px-3 py-2 font-medium ${e.amount >= 0 ? 'text-emerald-700' : 'text-red-600'}`}
                            >
                              {e.amount >= 0 ? '+' : ''}
                              {fmtRand(e.amount)}
                            </td>
                            <td className="px-3 py-2 text-slate-500">
                              {fmtRand(e.running_balance)}
                            </td>
                            <td className="px-3 py-2 text-slate-400">{fmtDate(e.created_at)}</td>
                            <td className="px-3 py-2 text-slate-500">{e.description || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Photo evidence */}
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">Photo Evidence</h3>
                {detail.evidence.photos.length === 0 ? (
                  <p className="text-xs text-slate-400">No photos attached to this job.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {detail.evidence.photos.map((p, i) => (
                      <a
                        key={`${p.stage}-${i}`}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group overflow-hidden rounded-lg border border-slate-200"
                      >
                        <img
                          src={p.url}
                          alt={`${EVIDENCE_STAGE_LABELS[p.stage] || p.stage} photo ${i + 1}`}
                          className="h-24 w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="bg-white px-2 py-1.5">
                          <p className="text-[10px] font-medium text-slate-600">
                            {EVIDENCE_STAGE_LABELS[p.stage] || p.stage}
                          </p>
                          <p className="text-[10px] text-slate-400">{fmtDate(p.at)}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Event timeline */}
              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">Event Timeline</h3>
                {detail.evidence.timeline.length === 0 ? (
                  <p className="text-xs text-slate-400">No tracked events for this job.</p>
                ) : (
                  <ol className="border-l border-slate-200 pl-4">
                    {detail.evidence.timeline.map((t, i) => (
                      <li key={i} className="relative mb-3 last:mb-0">
                        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100" />
                        <p className="text-xs font-medium text-slate-700">
                          {EVIDENCE_EVENT_LABELS[t.event] || t.event}
                        </p>
                        {t.note && <p className="text-xs text-slate-500">{t.note}</p>}
                        <p className="text-[10px] text-slate-400">{fmtDate(t.at)}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

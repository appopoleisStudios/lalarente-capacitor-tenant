import type { VendorPartyOptions, VendorTransactionFilters } from '../types/admin';

const STATUS_OPTIONS = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'];

/**
 * Filter bar for the vendor transaction list: status, date range,
 * vendor and tenant dropdowns sourced from the party-options RPC.
 */
export default function TransactionFilters({
  options,
  filters,
  onChange,
  onClear,
}: {
  options: VendorPartyOptions | null;
  filters: VendorTransactionFilters;
  onChange: (f: VendorTransactionFilters) => void;
  onClear: () => void;
}) {
  const set = (patch: Partial<VendorTransactionFilters>) => onChange({ ...filters, ...patch });

  const selectCls =
    'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-sm focus:border-blue-400 focus:outline-none';
  const labelCls = 'block text-[11px] font-medium text-slate-500';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className={labelCls}>Status</label>
          <select
            aria-label="Status"
            className={selectCls}
            value={filters.payment_status ?? ''}
            onChange={(e) => set({ payment_status: e.target.value || null })}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>From</label>
          <input
            type="date"
            aria-label="From"
            className={selectCls}
            value={filters.from ?? ''}
            onChange={(e) => set({ from: e.target.value || null })}
          />
        </div>
        <div>
          <label className={labelCls}>To</label>
          <input
            type="date"
            aria-label="To"
            className={selectCls}
            value={filters.to ?? ''}
            onChange={(e) => set({ to: e.target.value || null })}
          />
        </div>
        <div>
          <label className={labelCls}>Vendor</label>
          <select
            aria-label="Vendor"
            className={selectCls}
            value={filters.vendor_id ?? ''}
            onChange={(e) => set({ vendor_id: e.target.value || null })}
          >
            <option value="">All vendors</option>
            {options?.vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.full_name || 'Unnamed'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Tenant</label>
          <select
            aria-label="Tenant"
            className={selectCls}
            value={filters.tenant_id ?? ''}
            onChange={(e) => set({ tenant_id: e.target.value || null })}
          >
            <option value="">All tenants</option>
            {options?.tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name || 'Unnamed'}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={onClear}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50"
          >
            ✕ Clear
          </button>
        </div>
      </div>
    </div>
  );
}

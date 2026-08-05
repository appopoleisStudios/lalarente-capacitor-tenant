import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TransactionFilters from '../TransactionFilters';
import type { VendorPartyOptions, VendorTransactionFilters } from '../../types/admin';

const options: VendorPartyOptions = {
  vendors: [
    { id: 'v1', full_name: 'Sipho Dlamini' },
    { id: 'v2', full_name: 'Thabo Nkosi' },
  ],
  tenants: [{ id: 't1', full_name: 'Zanele Khumalo' }],
};

const emptyFilters: VendorTransactionFilters = {
  payment_status: null,
  from: null,
  to: null,
  vendor_id: null,
  tenant_id: null,
};

describe('TransactionFilters', () => {
  it('renders status, date, vendor and tenant controls', () => {
    render(
      <TransactionFilters
        options={options}
        filters={emptyFilters}
        onChange={() => {}}
        onClear={() => {}}
      />
    );
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
    expect(screen.getByLabelText('Vendor')).toBeInTheDocument();
    expect(screen.getByLabelText('Tenant')).toBeInTheDocument();
  });

  it('populates vendor/tenant dropdowns from options', () => {
    render(
      <TransactionFilters
        options={options}
        filters={emptyFilters}
        onChange={() => {}}
        onClear={() => {}}
      />
    );
    const vendor = screen.getByLabelText('Vendor') as HTMLSelectElement;
    expect(vendor.options.length).toBe(3); // All + 2 vendors
    expect(screen.getByRole('option', { name: 'Sipho Dlamini' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Thabo Nkosi' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Zanele Khumalo' })).toBeInTheDocument();
  });

  it('fires onChange when a status is selected', () => {
    const onChange = vi.fn();
    render(
      <TransactionFilters
        options={options}
        filters={emptyFilters}
        onChange={onChange}
        onClear={() => {}}
      />
    );
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
    expect(onChange).toHaveBeenCalledWith({ ...emptyFilters, payment_status: 'completed' });
  });

  it('fires onChange when a vendor is selected', () => {
    const onChange = vi.fn();
    render(
      <TransactionFilters
        options={options}
        filters={emptyFilters}
        onChange={onChange}
        onClear={() => {}}
      />
    );
    fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'v1' } });
    expect(onChange).toHaveBeenCalledWith({ ...emptyFilters, vendor_id: 'v1' });
  });

  it('fires onClear when the clear button is pressed', () => {
    const onClear = vi.fn();
    render(
      <TransactionFilters
        options={options}
        filters={emptyFilters}
        onChange={() => {}}
        onClear={onClear}
      />
    );
    fireEvent.click(screen.getByText('✕ Clear'));
    expect(onClear).toHaveBeenCalled();
  });

  it('renders currently applied filter values', () => {
    render(
      <TransactionFilters
        options={options}
        filters={{
          payment_status: 'failed',
          from: '2026-08-01',
          to: '2026-08-10',
          vendor_id: 'v2',
          tenant_id: 't1',
        }}
        onChange={() => {}}
        onClear={() => {}}
      />
    );
    expect((screen.getByLabelText('Status') as HTMLSelectElement).value).toBe('failed');
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('2026-08-01');
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('2026-08-10');
    expect((screen.getByLabelText('Vendor') as HTMLSelectElement).value).toBe('v2');
    expect((screen.getByLabelText('Tenant') as HTMLSelectElement).value).toBe('t1');
  });
});

/**
 * CT7-022 v2 — owner edits/removals of standard lease clauses.
 */
import {
  applyClauseOverrides,
  generateLeaseHTML,
  getStandardClauses,
  LeaseData,
} from '../leasePdfService';

const lease: LeaseData = {
  id: 'lease-1',
  property: { title: 'Test House', address: '1 Main Rd', city: 'Durban' },
  owner: { full_name: 'Owner' },
  tenant: { full_name: 'Tenant' },
  start_date: '2026-12-01',
  end_date: '2027-11-30',
  monthly_rent: 7500,
  deposit_amount: 7500,
  payment_due_day: 1,
  lease_type: 'fixed',
  interest_on_arrears_rate: null,
  rent_escalation_type: 'fixed_percentage',
  rent_escalation_value: 8,
  rent_escalation_frequency_months: 12,
  owner_signature_url: null,
  tenant_signature_url: null,
  owner_signed_at: null,
  tenant_signed_at: null,
  executed_at: null,
};

describe('lease clause overrides', () => {
  it('removes and edits editable clauses', () => {
    const out = applyClauseOverrides(getStandardClauses(lease), {
      pets: { removed: true },
      maintenance: { body: 'Tenant maintains the pool.' },
    });
    expect(out.find((c) => c.id === 'pets')).toBeUndefined();
    expect(out.find((c) => c.id === 'maintenance')?.body).toBe('Tenant maintains the pool.');
  });

  it('ignores overrides on locked (statutory / form-driven) clauses', () => {
    const out = applyClauseOverrides(getStandardClauses(lease), {
      deposit_refund: { removed: true },
      inspections: { body: 'No inspections.' },
    });
    expect(out.find((c) => c.id === 'deposit_refund')).toBeDefined();
    expect(out.find((c) => c.id === 'inspections')?.body).not.toBe('No inspections.');
  });

  it('renders overrides and escapes edited text in the PDF HTML', () => {
    const html = generateLeaseHTML(lease, undefined, {
      pets: { removed: true },
      maintenance: { body: 'Pool <b>weekly</b>' },
    });
    expect(html).not.toContain('>PETS<');
    expect(html).toContain('Pool &lt;b&gt;weekly&lt;/b&gt;');
  });

  it('falls back to the clauses stored on the lease (signing / regeneration)', () => {
    const html = generateLeaseHTML({
      ...lease,
      lease_custom_clauses: 'Garden service included.',
      lease_clause_overrides: { pets: { removed: true } },
    });
    expect(html).toContain('Garden service included.');
    expect(html).not.toContain('>PETS<');
  });

  it('numbers financial clauses without gaps', () => {
    const html = generateLeaseHTML(lease); // deposit, no arrears interest, escalation
    expect(html).toContain('2. SECURITY DEPOSIT');
    expect(html).toContain('3. RENT ESCALATION');
  });

  it('ignores malformed stored overrides instead of throwing', () => {
    const out = applyClauseOverrides(getStandardClauses(lease), {
      pets: { body: 42 as unknown as string },
    });
    expect(out.find((c) => c.id === 'pets')?.body).toContain('No pets');
  });

  // Overrides on signed leases are keyed by these ids. Renaming one would
  // silently bring a removed clause back when a PDF is regenerated.
  it('keeps clause ids stable', () => {
    expect(getStandardClauses(lease).map((c) => c.id)).toEqual([
      'use_of_premises',
      'maintenance',
      'inspections',
      'pets',
      'termination',
      'deposit_refund',
      'breach',
      'domicilium',
      'governing_law',
      'entire_agreement',
    ]);
  });
});

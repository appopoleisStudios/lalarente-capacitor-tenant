/**
 * Tests for property tax payment financial calculations.
 *
 * Coverage:
 * 1. totalDeductible — allowable, mixed_use apportionment, excluded categories
 * 2. summariseByCategory — grouping + deductible per category
 * 3. Tax-year boundary helpers — Feb 28 vs Feb 29 (leap year)
 * 4. Half-open range: endDate + 1 day produces correct exclusive bound
 */

import {
  totalDeductible,
  summariseByCategory,
  PropertyTaxPayment,
  TaxCategory,
  Deductibility,
} from '../propertyTaxPayments.api';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makePayment(
  overrides: Partial<PropertyTaxPayment> & {
    amount: number;
    deductibility: Deductibility;
    category?: TaxCategory;
    apportionment_pct?: number | null;
  }
): PropertyTaxPayment {
  return {
    id: 'test-id',
    property_id: 'prop-1',
    owner_id: 'owner-1',
    category: overrides.category ?? 'municipal_rates',
    description: null,
    paid_on: '2026-06-01',
    document_url: null,
    created_at: '2026-06-01T00:00:00Z',
    apportionment_pct: null,
    ...overrides,
  };
}

// ─── 1. totalDeductible ───────────────────────────────────────────────────────

describe('totalDeductible', () => {
  it('returns 0 for empty array', () => {
    expect(totalDeductible([])).toBe(0);
  });

  it('includes full amount for allowable', () => {
    const p = makePayment({ amount: 1500, deductibility: 'allowable' });
    expect(totalDeductible([p])).toBe(1500);
  });

  it('applies apportionment for mixed_use', () => {
    const p = makePayment({ amount: 2000, deductibility: 'mixed_use', apportionment_pct: 70 });
    expect(totalDeductible([p])).toBeCloseTo(1400, 2);
  });

  it('applies 0% apportionment correctly', () => {
    const p = makePayment({ amount: 1000, deductibility: 'mixed_use', apportionment_pct: 0 });
    expect(totalDeductible([p])).toBe(0);
  });

  it('applies 100% apportionment correctly', () => {
    const p = makePayment({ amount: 1000, deductibility: 'mixed_use', apportionment_pct: 100 });
    expect(totalDeductible([p])).toBeCloseTo(1000, 2);
  });

  it('excludes capital expenditure', () => {
    const p = makePayment({ amount: 50000, deductibility: 'capital' });
    expect(totalDeductible([p])).toBe(0);
  });

  it('excludes private expenses', () => {
    const p = makePayment({ amount: 3000, deductibility: 'private' });
    expect(totalDeductible([p])).toBe(0);
  });

  it('excludes uncertain expenses', () => {
    const p = makePayment({ amount: 800, deductibility: 'uncertain' });
    expect(totalDeductible([p])).toBe(0);
  });

  it('excludes mixed_use with null apportionment_pct', () => {
    const p = makePayment({ amount: 1200, deductibility: 'mixed_use', apportionment_pct: null });
    expect(totalDeductible([p])).toBe(0);
  });

  it('sums multiple payments across categories', () => {
    const payments = [
      makePayment({ amount: 1000, deductibility: 'allowable', category: 'municipal_rates' }),
      makePayment({
        amount: 2000,
        deductibility: 'mixed_use',
        apportionment_pct: 50,
        category: 'insurance',
      }),
      makePayment({ amount: 5000, deductibility: 'capital', category: 'bond_interest' }),
      makePayment({ amount: 300, deductibility: 'private', category: 'other' }),
      makePayment({ amount: 400, deductibility: 'uncertain', category: 'municipal_levies' }),
    ];
    // 1000 + (2000 * 0.5) + 0 + 0 + 0 = 2000
    expect(totalDeductible(payments)).toBeCloseTo(2000, 2);
  });
});

// ─── 2. summariseByCategory ───────────────────────────────────────────────────

describe('summariseByCategory', () => {
  it('returns empty array for no payments', () => {
    expect(summariseByCategory([])).toEqual([]);
  });

  it('groups payments by category', () => {
    const payments = [
      makePayment({ amount: 500, deductibility: 'allowable', category: 'municipal_rates' }),
      makePayment({ amount: 300, deductibility: 'allowable', category: 'municipal_rates' }),
      makePayment({ amount: 1000, deductibility: 'allowable', category: 'insurance' }),
    ];
    const result = summariseByCategory(payments);
    expect(result).toHaveLength(2);
    const rates = result.find((r) => r.category === 'municipal_rates')!;
    expect(rates.total).toBe(800);
    expect(rates.deductible).toBe(800);
    const insurance = result.find((r) => r.category === 'insurance')!;
    expect(insurance.total).toBe(1000);
    expect(insurance.deductible).toBe(1000);
  });

  it('shows total > deductible when some are non-allowable', () => {
    const payments = [
      makePayment({ amount: 1000, deductibility: 'allowable', category: 'municipal_rates' }),
      makePayment({ amount: 500, deductibility: 'capital', category: 'municipal_rates' }),
    ];
    const result = summariseByCategory(payments);
    const rates = result.find((r) => r.category === 'municipal_rates')!;
    expect(rates.total).toBe(1500);
    expect(rates.deductible).toBe(1000);
  });

  it('computes mixed_use deductible per category', () => {
    const payments = [
      makePayment({
        amount: 2000,
        deductibility: 'mixed_use',
        apportionment_pct: 60,
        category: 'bond_interest',
      }),
    ];
    const result = summariseByCategory(payments);
    const bond = result.find((r) => r.category === 'bond_interest')!;
    expect(bond.total).toBe(2000);
    expect(bond.deductible).toBeCloseTo(1200, 2);
  });
});

// ─── 3. Tax-year boundary & leap-year ────────────────────────────────────────

describe('tax-year date boundaries', () => {
  // Mirrors OwnerTaxReportScreen.fetchTaxData: derive exclusive end as March 1
  // of the end year from startDate, never from endDate+1 (fails in leap years).
  function buildEndExclusive(startDate: Date): string {
    const taxEndYear = startDate.getFullYear() + 1;
    return `${taxEndYear}-03-01`;
  }

  it('non-leap year 2024/2025: exclusive end is 2025-03-01', () => {
    expect(buildEndExclusive(new Date('2024-03-01'))).toBe('2025-03-01');
  });

  it('leap year 2027/2028: exclusive end is 2028-03-01, not 2028-02-29', () => {
    expect(buildEndExclusive(new Date('2027-03-01'))).toBe('2028-03-01');
  });

  it('leap year 2028: payment on Feb 29 is within the tax year', () => {
    const start = '2027-03-01';
    const endExclusive = buildEndExclusive(new Date(start));
    const feb29 = '2028-02-29';
    expect(feb29 >= start).toBe(true);
    expect(feb29 < endExclusive).toBe(true);
  });

  it('payment on Mar 1 of end year is excluded (outside tax year)', () => {
    const start = '2027-03-01';
    const endExclusive = buildEndExclusive(new Date(start));
    const mar1 = '2028-03-01';
    expect(mar1 < endExclusive).toBe(false);
  });

  it('payment on Mar 1 of start year is included (first day of tax year)', () => {
    const start = '2026-03-01';
    const mar1 = '2026-03-01';
    expect(mar1 >= start).toBe(true);
  });
});

// ─── 4. Edge cases: apportionment precision ───────────────────────────────────

describe('mixed_use apportionment precision', () => {
  it('33.33% apportionment rounds correctly', () => {
    const p = makePayment({ amount: 3000, deductibility: 'mixed_use', apportionment_pct: 33.33 });
    // 3000 * 0.3333 = 999.9
    expect(totalDeductible([p])).toBeCloseTo(999.9, 1);
  });

  it('accumulates multiple mixed_use payments without floating-point blowup', () => {
    const payments = Array.from({ length: 12 }, (_, i) =>
      makePayment({
        amount: 1000,
        deductibility: 'mixed_use',
        apportionment_pct: 70,
        paid_on: `2026-${String(i + 1).padStart(2, '0')}-01`,
      })
    );
    // 12 × R700 = R8400
    expect(totalDeductible(payments)).toBeCloseTo(8400, 1);
  });
});

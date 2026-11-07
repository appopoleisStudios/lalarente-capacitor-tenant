// Unit tests for the tenant profile completeness util (CT7-013).
//
// SA reviewers for PR #193 flagged three edge-cases that must stay covered:
//   - Empty-string column with populated fica_documents JSON  → use JSON.
//   - Non-numeric / non-finite monthly_income values         → treat as missing.
//   - Supabase lookup errors                                 → status 'error',
//                                                              never silently "incomplete".

import { checkTenantProfileCompleteness } from '../utils/profileCompleteness';

const mockMaybeSingle = jest.fn();

jest.mock('@/src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args),
        })),
      })),
    })),
  },
}));

const completeRow = {
  full_name: 'Nashin Indraj',
  phone: '+27 82 000 1111',
  id_number: '8501015800085',
  date_of_birth: '1985-01-01',
  proof_of_address_url: 'https://cdn/proof.pdf',
  monthly_income: 25000,
  // CT7-014: FICA document uploads land inside the fica_documents JSON blob.
  fica_documents: {
    id_document_url: 'https://cdn/id.pdf',
    salary_certificate_urls: ['https://cdn/payslip-1.pdf'],
  },
};

beforeEach(() => {
  mockMaybeSingle.mockReset();
});

describe('checkTenantProfileCompleteness', () => {
  it('returns ok+complete when every field is populated on the columns', async () => {
    mockMaybeSingle.mockResolvedValue({ data: completeRow, error: null });

    const result = await checkTenantProfileCompleteness('u1');

    expect(result).toEqual({ status: 'ok', complete: true, missing: [] });
  });

  it('falls back to fica_documents JSON when the column is an empty string', async () => {
    // Empty-string column previously masked a populated legacy value via `??`.
    mockMaybeSingle.mockResolvedValue({
      data: {
        ...completeRow,
        id_number: '',
        date_of_birth: '',
        fica_documents: {
          ...completeRow.fica_documents,
          id_number: '8501015800085',
          date_of_birth: '1985-01-01',
        },
      },
      error: null,
    });

    const result = await checkTenantProfileCompleteness('u1');

    expect(result).toEqual({ status: 'ok', complete: true, missing: [] });
  });

  it('rejects whitespace-only strings as missing', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        ...completeRow,
        full_name: '   ',
        phone: '\t\n',
      },
      error: null,
    });

    const result = await checkTenantProfileCompleteness('u1');

    expect(result).toMatchObject({ status: 'ok', complete: false });
    if (result.status === 'ok' && !result.complete) {
      expect(result.missing).toEqual(expect.arrayContaining(['Full name', 'Phone number']));
    }
  });

  it('treats non-finite / non-positive monthly_income as missing', async () => {
    for (const bad of [NaN, 0, -100, Infinity, 'invalid', null]) {
      mockMaybeSingle.mockResolvedValue({
        data: { ...completeRow, monthly_income: bad as never, fica_documents: null },
        error: null,
      });
      const result = await checkTenantProfileCompleteness('u1');
      expect(result).toMatchObject({ status: 'ok', complete: false });
      if (result.status === 'ok' && !result.complete) {
        expect(result.missing).toContain('Monthly income');
      }
    }
  });

  it('accepts numeric income stored as a string in the legacy JSON', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        ...completeRow,
        monthly_income: null,
        fica_documents: {
          ...completeRow.fica_documents,
          monthly_income: '15000' as unknown as number,
        },
      },
      error: null,
    });

    const result = await checkTenantProfileCompleteness('u1');

    expect(result).toEqual({ status: 'ok', complete: true, missing: [] });
  });

  it('returns status:error on Supabase lookup failure', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'connection reset' },
    });

    const result = await checkTenantProfileCompleteness('u1');

    expect(result).toEqual({ status: 'error', message: 'connection reset' });
  });

  // CT7-014 — document uploads required.

  it('flags missing when id_document_url is absent from fica_documents', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        ...completeRow,
        fica_documents: { salary_certificate_urls: ['https://cdn/payslip-1.pdf'] },
      },
      error: null,
    });

    const result = await checkTenantProfileCompleteness('u1');

    expect(result).toMatchObject({ status: 'ok', complete: false });
    if (result.status === 'ok' && !result.complete) {
      expect(result.missing).toContain('SA ID document');
      expect(result.missing).not.toContain('Salary certificate / payslip');
    }
  });

  it('flags missing when salary_certificate_urls is empty or missing', async () => {
    for (const bad of [null, undefined, [], ['   '], ['']]) {
      mockMaybeSingle.mockResolvedValue({
        data: {
          ...completeRow,
          fica_documents: {
            id_document_url: 'https://cdn/id.pdf',
            salary_certificate_urls: bad as never,
          },
        },
        error: null,
      });
      const result = await checkTenantProfileCompleteness('u1');
      expect(result).toMatchObject({ status: 'ok', complete: false });
      if (result.status === 'ok' && !result.complete) {
        expect(result.missing).toContain('Salary certificate / payslip');
      }
    }
  });

  it('accepts salary certificates when at least one non-blank URL is present', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        ...completeRow,
        fica_documents: {
          id_document_url: 'https://cdn/id.pdf',
          salary_certificate_urls: ['', '   ', 'https://cdn/payslip-3.pdf'],
        },
      },
      error: null,
    });

    const result = await checkTenantProfileCompleteness('u1');

    expect(result).toEqual({ status: 'ok', complete: true, missing: [] });
  });

  it('returns incomplete with "Profile not found" when no row exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await checkTenantProfileCompleteness('u1');

    expect(result).toEqual({ status: 'ok', complete: false, missing: ['Profile not found'] });
  });
});

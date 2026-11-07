// Unit tests for persistFicaDocField (CT7-014 → PR #195 round 2).
// SA review raised a P1: silently absorbed read errors could cause the
// subsequent update to wipe the existing fica_documents JSON.

import { persistFicaDocField } from '../utils/persistFicaDoc';

const mockFrom = jest.fn();

jest.mock('@/src/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

beforeEach(() => {
  mockFrom.mockReset();
});

/** Build a chainable mock returning the given read result from
 *  .select().eq().single() and the given write result from
 *  .update().eq(). Both `update` and `select` are tracked via jest
 *  mock-fn references so tests can assert what was written. */
function mockSupabase(readResult: unknown, writeResult: unknown) {
  const updateMock = jest.fn().mockReturnValue({
    eq: jest.fn().mockResolvedValue(writeResult),
  });
  mockFrom.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue(readResult),
      }),
    }),
    update: updateMock,
  });
  return { updateMock };
}

describe('persistFicaDocField', () => {
  it('merges the new field into the existing JSON and writes it back', async () => {
    const { updateMock } = mockSupabase(
      {
        data: { fica_documents: { id_number: '8501015800085', monthly_income: 25000 } },
        error: null,
      },
      { error: null }
    );

    await persistFicaDocField('u1', 'id_document_url', 'https://cdn/id.pdf');

    expect(updateMock).toHaveBeenCalledWith({
      fica_documents: {
        id_number: '8501015800085',
        monthly_income: 25000,
        id_document_url: 'https://cdn/id.pdf',
      },
    });
  });

  it('starts from {} when no row has fica_documents yet', async () => {
    const { updateMock } = mockSupabase(
      { data: { fica_documents: null }, error: null },
      { error: null }
    );

    await persistFicaDocField('u1', 'salary_certificate_urls', ['https://cdn/payslip.pdf']);

    expect(updateMock).toHaveBeenCalledWith({
      fica_documents: { salary_certificate_urls: ['https://cdn/payslip.pdf'] },
    });
  });

  it('throws and does NOT write when the read fails — prevents JSON wipe', async () => {
    const { updateMock } = mockSupabase(
      { data: null, error: { message: 'row not visible under RLS' } },
      { error: null }
    );

    await expect(
      persistFicaDocField('u1', 'id_document_url', 'https://cdn/id.pdf')
    ).rejects.toThrow(/row not visible under RLS/);

    expect(updateMock).not.toHaveBeenCalled();
  });

  it('surfaces the write error with context', async () => {
    const { updateMock } = mockSupabase(
      { data: { fica_documents: {} }, error: null },
      { error: { message: 'permission denied' } }
    );

    await expect(
      persistFicaDocField('u1', 'id_document_url', 'https://cdn/id.pdf')
    ).rejects.toThrow(/permission denied/);

    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});

// CT7-068: an inspection report export that fails must keep its cause, so a
// timeout or database error reaches Sentry instead of a generic message.
import fs from 'fs';
import path from 'path';
import { sanitizeForSentry } from '@/src/core/observability/sentry';
import { RequestTimeoutError } from '@/src/lib/fetchWithTimeout';

const mockSingle = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: mockSingle }) }) }),
  },
}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }));
jest.mock('../../documents/api/documentsApi', () => ({ documentsApi: {} }));
jest.mock('@/src/shared/utils/storageDataUri', () => ({
  toDataUri: jest.fn(),
  signatureDataUri: jest.fn(),
}));
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('@/src/core/config/env', () => ({ env: { sentry: { dsn: '' } } }));

// eslint-disable-next-line import/first
import { exportInspectionReportPdf } from '../../owner/utils/pdfReports';

describe('inspection report export keeps its error (CT7-068)', () => {
  it('a timed-out inspection read reaches Sentry as "request timed out"', async () => {
    // supabase-js maps a rejected fetch into a PostgREST error carrying its message
    const dbError = {
      code: '',
      message: `RequestTimeoutError: ${new RequestTimeoutError(30_000).message}`,
    };
    mockSingle.mockResolvedValueOnce({ data: null, error: dbError });

    const err = await exportInspectionReportPdf('insp-1', 'user-1').catch((e) => e);
    expect(err).toBe(dbError);
    const reported = sanitizeForSentry(err);
    expect(reported.message).toBe('request timed out');
    expect(reported.name).toBe('RequestTimeoutError');
  });

  it('a database error keeps its code', async () => {
    const dbError = { code: '42501', message: 'permission denied for table inspections' };
    mockSingle.mockResolvedValueOnce({ data: null, error: dbError });

    const err = await exportInspectionReportPdf('insp-1', 'user-1').catch((e) => e);
    expect(sanitizeForSentry(err).message).toMatch(/^42501/);
  });

  it('a timeout thrown directly is classified too, with no user text', () => {
    const reported = sanitizeForSentry(new RequestTimeoutError(120_000));
    expect(reported.message).toBe('request timed out');
  });

  it('only the exact timeout text is classified, nothing that merely contains it', () => {
    for (const message of [
      'insert failed: Request timed out after 30s for tenant@example.com',
      'Some other text. Request timed out after 30s',
      'UnknownError: Request timed out after 30s',
    ]) {
      expect(sanitizeForSentry(new Error(message)).message).toBe('API error');
    }
    // a database code is never overridden by the phrase
    expect(
      sanitizeForSentry({ code: '57014', message: 'x Request timed out after 30s' }).message
    ).toMatch(/^57014/);
  });

  const screens = ['InspectionScreen.tsx', 'OwnerInspectionDetailScreen.tsx'];
  it.each(screens)('%s reports and logs the export failure', (file) => {
    const src = fs.readFileSync(path.resolve(__dirname, '../screens', file), 'utf8');
    const handler = src.slice(src.indexOf('exportInspectionReportPdf(inspection.id'));
    const catchBlock = handler.slice(handler.indexOf('} catch'), handler.indexOf('} finally'));
    expect(catchBlock).toMatch(/catch \(err\)/);
    expect(catchBlock).toMatch(/reportApiError\(err, 'inspections', 'export'\)/);
    expect(catchBlock).toMatch(/console\.error\([^)]*sanitizeForSentry\(err\)/); // never the raw error (breadcrumbs)
  });
});

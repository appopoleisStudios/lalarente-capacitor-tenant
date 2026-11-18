/**
 * CT7-052: an active lease was left without its PDF after one failed attempt,
 * and the owner was told "signed and activated!" with no hint.
 */
import fs from 'fs';
import path from 'path';

import { LEASE_PDF_MISSING_MESSAGE, PDF_ATTEMPTS, withPdfRetry } from '../leaseExecutionService';

jest.mock('../../../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../leasePdfService', () => ({ generateAndUploadLeasePDF: jest.fn() }));
const mockReport = jest.fn();
jest.mock('@/src/core/observability/sentry', () => ({
  reportApiError: (...a: unknown[]) => mockReport(...a),
}));

beforeEach(() => {
  mockReport.mockClear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('withPdfRetry (CT7-052)', () => {
  it('returns the URL when a later attempt succeeds', async () => {
    const generate = jest
      .fn()
      .mockRejectedValueOnce(new Error('Could not load a signature image'))
      .mockResolvedValueOnce('contracts/l1/signed-lease.pdf');
    await expect(withPdfRetry(generate, 3, 0)).resolves.toBe('contracts/l1/signed-lease.pdf');
    expect(generate).toHaveBeenCalledTimes(2);
    expect(mockReport).toHaveBeenCalledTimes(1);
  });

  it('gives up with null after every attempt failed, reporting each', async () => {
    const generate = jest.fn().mockRejectedValue(new Error('print failed'));
    await expect(withPdfRetry(generate, PDF_ATTEMPTS, 0)).resolves.toBeNull();
    expect(generate).toHaveBeenCalledTimes(PDF_ATTEMPTS);
    expect(mockReport).toHaveBeenCalledTimes(PDF_ATTEMPTS);
  });

  it('tries only once when the first attempt works', async () => {
    const generate = jest.fn().mockResolvedValue('u');
    await withPdfRetry(generate, 3, 0);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('retries more than once by default', () => {
    expect(PDF_ATTEMPTS).toBeGreaterThan(1);
  });
});

describe('owner is told when the PDF is missing (CT7-052)', () => {
  const screen = fs.readFileSync(
    path.resolve(__dirname, '../../../owner/screens/OwnerLeaseDetailScreen.tsx'),
    'utf8'
  );

  it('the message points at the Generate PDF button', () => {
    expect(LEASE_PDF_MISSING_MESSAGE).toMatch(/Generate PDF/);
    expect(screen).toMatch(/Generate PDF/); // the button it names exists
  });

  it("the signing flow uses executeLease's pdfGenerated flag for its alert", () => {
    expect(screen).toMatch(/\(\{ pdfGenerated \} = await executeLease\(lease\.id\)\)/);
    expect(screen).toMatch(
      /pdfGenerated\s*\?\s*'Lease agreement signed and activated!'\s*:\s*LEASE_PDF_MISSING_MESSAGE/
    );
  });
});

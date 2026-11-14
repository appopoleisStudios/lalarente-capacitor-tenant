/**
 * Signed leases are in the private `contracts` bucket; the stored public URL
 * returns "Bucket not found". The app must open them via a signed URL.
 */
const mockCreateSignedUrl = jest.fn();
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: jest.fn(() => ({ createSignedUrl: mockCreateSignedUrl })) } },
}));

import { getLeaseDocumentUrl } from '../storageService';
import { supabase } from '../../../../lib/supabase';

const stored =
  'https://x.supabase.co/storage/v1/object/public/contracts/lease-1/signed-lease.pdf';

beforeEach(() => jest.clearAllMocks());

it('signs the contracts path instead of using the public URL', async () => {
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/url' }, error: null });
  await expect(getLeaseDocumentUrl(stored)).resolves.toBe('https://signed/url');
  expect(supabase.storage.from).toHaveBeenCalledWith('contracts');
  expect(mockCreateSignedUrl).toHaveBeenCalledWith('lease-1/signed-lease.pdf', 600);
});

it('throws a clear error when signing fails (e.g. not a party to the lease)', async () => {
  mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'Object not found' } });
  await expect(getLeaseDocumentUrl(stored)).rejects.toThrow('Could not open the lease document');
});

it('leaves non-contracts URLs unchanged', async () => {
  await expect(getLeaseDocumentUrl('https://example.com/a.pdf')).resolves.toBe(
    'https://example.com/a.pdf'
  );
  expect(mockCreateSignedUrl).not.toHaveBeenCalled();
});

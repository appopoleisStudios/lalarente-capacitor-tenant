/**
 * Signed leases are in the private `contracts` bucket; the stored public URL
 * returns "Bucket not found". The app must open them via a signed URL.
 */
import { getLeaseDocumentUrl } from '../storageService';
import { supabase } from '../../../../lib/supabase';

const mockCreateSignedUrl = jest.fn();
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: jest.fn(() => ({ createSignedUrl: mockCreateSignedUrl })) } },
}));


const stored = 'https://x.supabase.co/storage/v1/object/public/contracts/lease-1/signed-lease.pdf';

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

it('refuses links that are not contracts objects', async () => {
  await expect(getLeaseDocumentUrl('https://example.com/a.pdf')).rejects.toThrow('unexpected link');
  expect(mockCreateSignedUrl).not.toHaveBeenCalled();
});

it('strips query strings and fragments and decodes the path', async () => {
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/url' }, error: null });
  await getLeaseDocumentUrl(
    'https://x.supabase.co/storage/v1/object/public/contracts/lease%201/signed-lease.pdf?t=1#p2'
  );
  expect(mockCreateSignedUrl).toHaveBeenCalledWith('lease 1/signed-lease.pdf', 600);
});

it('reports a malformed link clearly', async () => {
  await expect(
    getLeaseDocumentUrl('https://x.supabase.co/storage/v1/object/public/contracts/%E0%A4%A/x.pdf')
  ).rejects.toThrow('malformed link');
});

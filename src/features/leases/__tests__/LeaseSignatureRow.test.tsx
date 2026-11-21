import fs from 'fs';
import path from 'path';
/**
 * Tenant "My Lease" (Android): "Signed <date>" ran off the right edge because
 * the tenant's copy of the signature row lacked `flex: 1` on its left column,
 * and the signature thumbnails were blank because the private `signatures`
 * bucket was read through its public URL. Both screens now share this row.
 */
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { render, waitFor, act } from '@testing-library/react-native';
import LeaseSignatureRow from '../components/LeaseSignatureRow';

const mockCreateSignedUrl = jest.fn();
jest.mock('@/src/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) } },
}));

const PUBLIC_URL = 'https://x.supabase.co/storage/v1/object/public/signatures/lease-1/tenant.png';

describe('LeaseSignatureRow', () => {
  beforeEach(() => {
    mockCreateSignedUrl.mockReset();
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/tenant.png?t=1' } });
  });

  it('lets the name column shrink so "Signed <date>" stays on screen', () => {
    const { getByTestId } = render(
      <LeaseSignatureRow
        label="Tenant"
        name="You"
        signedAt="2026-11-18T06:40:13Z"
        accentColor="#007A4D"
      />
    );
    const status = getByTestId('lease-signature-status-tenant');
    expect(StyleSheet.flatten(status.props.style).flexShrink).toBe(0);
    const left = getByTestId('lease-signature-left-tenant');
    expect(StyleSheet.flatten(left.props.style).flex).toBe(1);
  });

  it('loads the thumbnail through a signed URL, not the public one', async () => {
    const { UNSAFE_getByType } = render(
      <LeaseSignatureRow
        label="Tenant"
        name="You"
        signedAt="2026-11-18T06:40:13Z"
        signatureUrl={PUBLIC_URL}
        accentColor="#007A4D"
      />
    );
    await waitFor(() =>
      expect(UNSAFE_getByType(Image).props.source).toEqual({
        uri: 'https://signed/tenant.png?t=1',
      })
    );
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('lease-1/tenant.png', 3600);
  });

  it('shows no thumbnail when signing fails (the public URL cannot load)', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'denied' } });
    const { UNSAFE_queryByType } = render(
      <LeaseSignatureRow
        label="Tenant"
        name="You"
        signedAt="2026-11-18T06:40:13Z"
        signatureUrl={PUBLIC_URL}
        accentColor="#007A4D"
      />
    );
    await waitFor(() => expect(mockCreateSignedUrl).toHaveBeenCalled());
    expect(UNSAFE_queryByType(Image)).toBeNull();
  });

  it('re-signs the URL when the image fails to load (expired link)', async () => {
    const { UNSAFE_getByType } = render(
      <LeaseSignatureRow
        label="Tenant"
        name="You"
        signedAt="2026-11-18T06:40:13Z"
        signatureUrl={PUBLIC_URL}
        accentColor="#007A4D"
      />
    );
    await waitFor(() => expect(UNSAFE_getByType(Image)).toBeTruthy());
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/tenant.png?t=2' } });
    act(() => UNSAFE_getByType(Image).props.onError());
    await waitFor(() =>
      expect(UNSAFE_getByType(Image).props.source).toEqual({ uri: 'https://signed/tenant.png?t=2' })
    );
  });

  it('stops re-signing after two failed reloads (no request storm)', async () => {
    const { UNSAFE_getByType } = render(
      <LeaseSignatureRow
        label="Tenant"
        name="You"
        signedAt="2026-11-18T06:40:13Z"
        signatureUrl={PUBLIC_URL}
        accentColor="#007A4D"
      />
    );
    await waitFor(() => expect(UNSAFE_getByType(Image)).toBeTruthy());
    for (let i = 0; i < 5; i++) {
      act(() => UNSAFE_getByType(Image).props.onError());
      await waitFor(() => expect(UNSAFE_getByType(Image)).toBeTruthy());
    }
    // first load + 2 retries, however many times the image errors
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(3);
  });

  it('signs the new file when the signature URL changes', async () => {
    const { rerender } = render(
      <LeaseSignatureRow
        label="Tenant"
        name="You"
        signedAt={null}
        signatureUrl={PUBLIC_URL}
        accentColor="#007A4D"
      />
    );
    await waitFor(() =>
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('lease-1/tenant.png', 3600)
    );
    rerender(
      <LeaseSignatureRow
        label="Tenant"
        name="You"
        signedAt={null}
        signatureUrl={PUBLIC_URL.replace('lease-1', 'lease-2')}
        accentColor="#007A4D"
      />
    );
    await waitFor(() =>
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('lease-2/tenant.png', 3600)
    );
  });
});

// CT7-044: the tenant screen had its own signature row (date ran off screen,
// blank image from the public URL). Both lease screens must use the shared row.
describe.each(['tenant/screens/TenantLeaseScreen.tsx', 'owner/screens/OwnerLeaseDetailScreen.tsx'])(
  '%s signatures (CT7-044)',
  (file) => {
    // comments dropped: commented-out rows render nothing
    const src = fs
      .readFileSync(path.resolve(__dirname, '../../', file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    it('renders both parties with the shared LeaseSignatureRow', () => {
      expect(src.match(/<LeaseSignatureRow\b/g)?.length).toBe(2);
      expect(src).toMatch(/signatureUrl=\{lease\.owner_signature_url\}/);
      expect(src).toMatch(/signatureUrl=\{lease\.tenant_signature_url\}/);
    });

    it('never loads a signature from a public URL', () => {
      expect(src).not.toMatch(/getPublicUrl/);
    });
  }
);

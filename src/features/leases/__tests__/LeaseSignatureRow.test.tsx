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
});

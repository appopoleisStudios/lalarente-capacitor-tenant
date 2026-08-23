import type { VendorProfile } from '../types/vendor.types';

export type PendingVendorSelection = Pick<VendorProfile, 'id' | 'full_name' | 'business_name'>;

type PendingRecord = PendingVendorSelection & { userId: string };

let pending: PendingRecord | null = null;

/** Store a directory pick so the report form can consume it after replace/back. */
export function setPendingVendorSelection(userId: string, vendor: PendingVendorSelection): void {
  pending = {
    userId,
    id: vendor.id,
    full_name: vendor.full_name,
    business_name: vendor.business_name,
  };
}

/** Read and clear the last directory pick for this user. Returns null if none or mismatch. */
export function consumePendingVendorSelection(
  userId: string | null | undefined
): PendingVendorSelection | null {
  const value = pending;
  pending = null;
  if (!value || !userId || value.userId !== userId) return null;
  const { userId: _bound, ...vendor } = value;
  return vendor;
}

export function clearPendingVendorSelection(): void {
  pending = null;
}

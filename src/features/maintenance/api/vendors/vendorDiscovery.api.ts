/**
 * Vendor Discovery API
 * Find and search for vendors
 */

import { supabase } from '@/src/lib/supabase';
import type { ServiceCategory } from '../types/maintenance.types';
import type { VendorProfile, VendorServiceArea } from '../types/vendor.types';

const VENDOR_PROFILE_COLUMNS = 'id, full_name, email, phone, avatar_url, business_name, role';

function asVendor(row: unknown): VendorProfile | null {
  if (!row || typeof row !== 'object') return null;
  return row as VendorProfile;
}

async function attachDirectoryMeta(vendors: VendorProfile[]): Promise<VendorProfile[]> {
  const ids = vendors.map((v) => v.id).filter(Boolean);
  if (ids.length === 0) return vendors;

  const [{ data: areaRows, error: areaError }, { data: serviceRows, error: serviceError }] =
    await Promise.all([
      supabase
        .from('vendor_service_areas')
        .select('vendor_id, city, province')
        .in('vendor_id', ids),
      supabase
        .from('vendor_services')
        .select('vendor_id, category:service_categories(name)')
        .eq('is_active', true)
        .in('vendor_id', ids),
    ]);

  if (areaError) throw areaError;
  if (serviceError) throw serviceError;

  const areasByVendor = new Map<string, VendorServiceArea[]>();
  for (const row of areaRows || []) {
    const list = areasByVendor.get(row.vendor_id) ?? [];
    list.push({ city: row.city, province: row.province });
    areasByVendor.set(row.vendor_id, list);
  }

  const tradesByVendor = new Map<string, string[]>();
  for (const row of serviceRows || []) {
    const name = (row.category as { name?: string } | null)?.name;
    if (!name) continue;
    const list = tradesByVendor.get(row.vendor_id) ?? [];
    if (!list.includes(name)) list.push(name);
    tradesByVendor.set(row.vendor_id, list);
  }

  return vendors.map((vendor) => ({
    ...vendor,
    service_areas: areasByVendor.get(vendor.id) ?? [],
    trades: tradesByVendor.get(vendor.id) ?? [],
  }));
}

export function vendorMatchesDirectoryQuery(vendor: VendorProfile, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystacks = [
    vendor.business_name,
    vendor.full_name,
    vendor.email,
    ...(vendor.trades ?? []),
    ...(vendor.service_areas ?? []).flatMap((a) => [a.city, a.province]),
  ];
  return haystacks.some((value) => value && value.toLowerCase().includes(q));
}

/**
 * Get vendors by service category (for Open Market requests)
 *
 * @param categoryId - The service category ID
 * @returns Array of vendors offering this service
 *
 * @example
 * ```typescript
 * const vendors = await getVendorsByCategory(categoryId);
 * ```
 */
export async function getVendorsByCategory(categoryId: string): Promise<VendorProfile[]> {
  const { data, error } = await supabase
    .from('vendor_services')
    .select(
      `
      vendor_id,
      vendor:profiles!vendor_id(
        id,
        full_name,
        email,
        phone,
        avatar_url,
        business_name
      )
    `
    )
    .eq('category_id', categoryId)
    .eq('is_active', true);

  if (error) throw error;

  const uniqueVendors = Array.from(
    new Map(data?.map((item) => [item.vendor_id, item.vendor]) || []).values()
  )
    .map(asVendor)
    .filter((vendor): vendor is VendorProfile => Boolean(vendor));

  return attachDirectoryMeta(uniqueVendors);
}

/**
 * Full vendor directory (Plane #106). Optional category filter.
 * Used by owner/tenant browse when no ticket category is selected.
 */
export async function getVendorDirectory(options?: {
  categoryId?: string;
}): Promise<VendorProfile[]> {
  if (options?.categoryId) {
    return getVendorsByCategory(options.categoryId);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(VENDOR_PROFILE_COLUMNS)
    .eq('role', 'vendor');

  if (error) throw error;
  return attachDirectoryMeta((data || []) as unknown as VendorProfile[]);
}

/**
 * Get dedicated vendors for a property (for Invite Only requests)
 *
 * @param propertyId - The property ID
 * @param categoryId - Optional category filter
 * @returns Array of dedicated vendors
 *
 * @example
 * ```typescript
 * const vendors = await getDedicatedVendors(propertyId, categoryId);
 * ```
 */
export async function getDedicatedVendors(
  propertyId: string,
  categoryId?: string
): Promise<VendorProfile[]> {
  let query = supabase
    .from('dedicated_vendors')
    .select(
      `
      vendor_id,
      category_id,
      priority,
      vendor:profiles!vendor_id(
        id,
        full_name,
        email,
        phone,
        avatar_url,
        business_name
      )
    `
    )
    .eq('property_id', propertyId)
    .eq('is_active', true);

  // If category specified, filter by it (or get vendors with NULL category = handles all)
  if (categoryId) {
    query = query.or(`category_id.eq.${categoryId},category_id.is.null`);
  }

  query = query.order('priority', { ascending: true });

  const { data, error } = await query;

  if (error) throw error;

  return (data?.map((item) => item.vendor) || []) as unknown as VendorProfile[];
}

/**
 * Get vendors for a maintenance request (based on visibility and category)
 *
 * @param requestId - The maintenance request ID
 * @returns Array of vendors that can quote on this request
 *
 * @example
 * ```typescript
 * const vendors = await getVendorsForRequest(requestId);
 * ```
 */
export async function getVendorsForRequest(requestId: string): Promise<VendorProfile[]> {
  // First get the request details
  const { data: request, error: requestError } = await supabase
    .from('maintenance_requests')
    .select('id, property_id, category_id, visibility')
    .eq('id', requestId)
    .single();

  if (requestError) throw requestError;

  const typedRequest = request as any;

  if (!typedRequest) {
    throw new Error('Request not found');
  }

  // If visibility is 'public' (Open Market), get all vendors in category
  if (typedRequest.visibility === 'public' && typedRequest.category_id) {
    return getVendorsByCategory(typedRequest.category_id);
  }

  // If visibility is 'invited' (Invite Only), get dedicated vendors
  if (typedRequest.visibility === 'invited' && typedRequest.property_id) {
    return getDedicatedVendors(typedRequest.property_id, typedRequest.category_id || undefined);
  }

  // Default: return empty array
  return [];
}

/**
 * Search vendor by email
 *
 * @param email - The vendor's email address
 * @returns Vendor profile or null if not found
 *
 * @example
 * ```typescript
 * const vendor = await searchVendorByEmail('vendor@example.com');
 * ```
 */
export async function searchVendorByEmail(email: string): Promise<VendorProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      `
      id,
      full_name,
      email,
      phone,
      avatar_url,
      business_name,
      role
    `
    )
    .eq('email', email.toLowerCase().trim())
    .eq('role', 'vendor')
    .single();

  if (error) {
    // If not found, return null (not an error)
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data as unknown as VendorProfile;
}

/**
 * Get vendor's service categories
 *
 * @param vendorId - The vendor's user ID
 * @returns Array of service categories the vendor offers
 *
 * @example
 * ```typescript
 * const categories = await getVendorCategories(vendorId);
 * ```
 */
export async function getVendorCategories(vendorId: string): Promise<ServiceCategory[]> {
  const { data, error } = await supabase
    .from('vendor_services')
    .select(
      `
      category_id,
      category:service_categories!category_id(
        id,
        name,
        description
      )
    `
    )
    .eq('vendor_id', vendorId)
    .eq('is_active', true);

  if (error) throw error;

  // Extract unique categories
  const uniqueCategories = Array.from(
    new Map(data?.map((item) => [item.category_id, item.category]) || []).values()
  );

  return uniqueCategories as ServiceCategory[];
}

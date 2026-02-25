/**
 * Vendor Discovery API
 * Find and search for vendors
 */

import { supabase } from '@/src/lib/supabase';
import type { ServiceCategory } from '../types/maintenance.types';
import type { VendorProfile } from '../types/vendor.types';

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
    .select(`
      vendor_id,
      vendor:profiles!vendor_id(
        id,
        full_name,
        email,
        phone,
        avatar_url,
        business_name,
        rating
      )
    `)
    .eq('category_id', categoryId)
    .eq('is_active', true);

  if (error) throw error;

  // Extract unique vendors (a vendor might have multiple services in same category)
  const uniqueVendors = Array.from(
    new Map(data?.map(item => [item.vendor_id, item.vendor]) || []).values()
  );

  return uniqueVendors as unknown as VendorProfile[];
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
    .select(`
      vendor_id,
      category_id,
      priority,
      vendor:profiles!vendor_id(
        id,
        full_name,
        email,
        phone,
        avatar_url,
        business_name,
        rating
      )
    `)
    .eq('property_id', propertyId)
    .eq('is_active', true);

  // If category specified, filter by it (or get vendors with NULL category = handles all)
  if (categoryId) {
    query = query.or(`category_id.eq.${categoryId},category_id.is.null`);
  }

  query = query.order('priority', { ascending: true });

  const { data, error } = await query;

  if (error) throw error;

  return (data?.map(item => item.vendor) || []) as unknown as VendorProfile[];
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
    .select(`
      id,
      full_name,
      email,
      phone,
      avatar_url,
      business_name,
      rating,
      role
    `)
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
    .select(`
      category_id,
      category:service_categories!category_id(
        id,
        name,
        description
      )
    `)
    .eq('vendor_id', vendorId)
    .eq('is_active', true);

  if (error) throw error;

  // Extract unique categories
  const uniqueCategories = Array.from(
    new Map(data?.map(item => [item.category_id, item.category]) || []).values()
  );

  return uniqueCategories as ServiceCategory[];
}

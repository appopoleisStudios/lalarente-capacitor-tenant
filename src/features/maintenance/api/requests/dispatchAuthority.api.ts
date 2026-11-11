import { supabase } from '@/src/lib/supabase';

export interface PropertyServiceItem {
  id: string;
  name: string;
  tenant_may_dispatch: boolean;
}

export async function getPropertyServiceItems(propertyId: string): Promise<PropertyServiceItem[]> {
  const { data, error } = await (supabase as any)
    .from('property_service_items')
    .select('id, name, tenant_may_dispatch')
    .eq('property_id', propertyId)
    .is('deleted_at', null)
    .order('created_at');
  if (error) throw error;
  return (data || []) as PropertyServiceItem[];
}

export async function releaseToTenantDispatch(reqId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('release_to_tenant_dispatch', { req_id: reqId });
  if (error) throw error;
}

export async function reclaimRequest(reqId: string, reason: string): Promise<void> {
  const { error } = await (supabase as any).rpc('reclaim_request', { req_id: reqId, reason });
  if (error) throw error;
}

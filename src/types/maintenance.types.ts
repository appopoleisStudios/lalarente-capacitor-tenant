import { Database } from './database.types';

// Maintenance Request types
export type MaintenanceRequest = Database['public']['Tables']['maintenance_requests']['Row'];
export type MaintenanceRequestInsert = Database['public']['Tables']['maintenance_requests']['Insert'];
export type MaintenanceRequestUpdate = Database['public']['Tables']['maintenance_requests']['Update'];

// Service Category types
export type ServiceCategory = Database['public']['Tables']['service_categories']['Row'];

// Extended types with relations
export type MaintenanceRequestWithRelations = MaintenanceRequest & {
  property?: Database['public']['Tables']['properties']['Row'];
  tenant?: Database['public']['Tables']['profiles']['Row'];
  owner?: Database['public']['Tables']['profiles']['Row'];
  category?: ServiceCategory;
  selected_vendor?: Database['public']['Tables']['profiles']['Row'];
  quotes?: any[];
};

// Profile type
export type Profile = Database['public']['Tables']['profiles']['Row'];

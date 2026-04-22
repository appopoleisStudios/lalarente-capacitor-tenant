import { Database } from '@/src/types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

// Mock Users for Testing
export const MOCK_USERS = {
  owner: {
    id: 'mock-owner-001',
    email: 'owner@lalarente.co.za',
    full_name: 'John van der Merwe',
    phone: '+27 82 123 4567',
    role: 'owner' as const,
    avatar_url: null,
    fica_documents: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  tenant: {
    id: 'mock-tenant-001',
    email: 'tenant@lalarente.co.za',
    full_name: 'Sarah Nkosi',
    phone: '+27 83 234 5678',
    role: 'tenant' as const,
    avatar_url: null,
    fica_documents: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  vendor: {
    id: 'mock-vendor-001',
    email: 'vendor@lalarente.co.za',
    full_name: 'Mike Botha',
    phone: '+27 84 345 6789',
    role: 'vendor' as const,
    avatar_url: null,
    fica_documents: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
} as const;

// Mock Maintenance Requests
export const MOCK_MAINTENANCE_REQUESTS = [
  {
    id: 'maint-001',
    property_id: 'prop-001',
    tenant_id: MOCK_USERS.tenant.id,
    owner_id: MOCK_USERS.owner.id,
    vendor_id: null,
    title: 'Leaking Kitchen Faucet',
    description: 'The kitchen faucet has been dripping constantly for the past week. Water is pooling under the sink.',
    priority: 'high' as const,
    status: 'open' as const,
    mms_status: 'notification' as const,
    images: [],
    category_id: 'cat-plumbing',
    estimated_cost: null,
    actual_cost: null,
    scheduled_date: null,
    completed_date: null,
    acknowledged_at: null,
    vendor_routed_at: null,
    quote_deadline: null,
    selected_vendor_id: null,
    selected_quote_id: null,
    po_id: null,
    visibility: 'invited' as const,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    property: {
      id: 'prop-001',
      title: 'Sunset Apartment 3B',
      address: '123 Long Street',
      city: 'Cape Town',
    },
    tenant: {
      id: MOCK_USERS.tenant.id,
      full_name: MOCK_USERS.tenant.full_name,
      avatar_url: null,
      email: MOCK_USERS.tenant.email,
      phone: MOCK_USERS.tenant.phone,
    },
    category: {
      id: 'cat-plumbing',
      name: 'Plumbing',
      description: 'Water, drainage, and pipe issues',
    },
  },
  {
    id: 'maint-002',
    property_id: 'prop-002',
    tenant_id: MOCK_USERS.tenant.id,
    owner_id: MOCK_USERS.owner.id,
    vendor_id: MOCK_USERS.vendor.id,
    title: 'Broken Window Lock',
    description: 'The lock on the bedroom window is broken and won\'t close properly. Security concern.',
    priority: 'medium' as const,
    status: 'assigned' as const,
    mms_status: 'po_issued' as const,
    images: [],
    category_id: 'cat-general',
    estimated_cost: 850,
    actual_cost: null,
    scheduled_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    completed_date: null,
    acknowledged_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    vendor_routed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    quote_deadline: null,
    selected_vendor_id: MOCK_USERS.vendor.id,
    selected_quote_id: 'quote-001',
    po_id: 'po-001',
    visibility: 'invited' as const,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    property: {
      id: 'prop-002',
      title: 'Green Park House',
      address: '45 Kloof Street',
      city: 'Cape Town',
    },
    tenant: {
      id: MOCK_USERS.tenant.id,
      full_name: MOCK_USERS.tenant.full_name,
      avatar_url: null,
      email: MOCK_USERS.tenant.email,
      phone: MOCK_USERS.tenant.phone,
    },
    category: {
      id: 'cat-general',
      name: 'General Maintenance',
      description: 'General repairs and maintenance',
    },
  },
  {
    id: 'maint-003',
    property_id: 'prop-001',
    tenant_id: MOCK_USERS.tenant.id,
    owner_id: MOCK_USERS.owner.id,
    vendor_id: MOCK_USERS.vendor.id,
    title: 'Geyser Not Heating',
    description: 'Hot water geyser stopped working. No hot water for 2 days.',
    priority: 'high' as const,
    status: 'in_progress' as const,
    mms_status: 'in_progress' as const,
    images: [],
    category_id: 'cat-electrical',
    estimated_cost: 2500,
    actual_cost: null,
    scheduled_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    completed_date: null,
    acknowledged_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    vendor_routed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    quote_deadline: null,
    selected_vendor_id: MOCK_USERS.vendor.id,
    selected_quote_id: 'quote-002',
    po_id: 'po-002',
    visibility: 'invited' as const,
    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    property: {
      id: 'prop-001',
      title: 'Sunset Apartment 3B',
      address: '123 Long Street',
      city: 'Cape Town',
    },
    tenant: {
      id: MOCK_USERS.tenant.id,
      full_name: MOCK_USERS.tenant.full_name,
      avatar_url: null,
      email: MOCK_USERS.tenant.email,
      phone: MOCK_USERS.tenant.phone,
    },
    category: {
      id: 'cat-electrical',
      name: 'Electrical',
      description: 'Electrical systems and appliances',
    },
  },
  {
    id: 'maint-004',
    property_id: 'prop-003',
    tenant_id: 'tenant-002',
    owner_id: MOCK_USERS.owner.id,
    vendor_id: MOCK_USERS.vendor.id,
    title: 'Garden Irrigation System',
    description: 'Sprinkler system repaired and tested successfully.',
    priority: 'low' as const,
    status: 'completed' as const,
    mms_status: 'completed' as const,
    images: [],
    category_id: 'cat-garden',
    estimated_cost: 1200,
    actual_cost: 1150,
    scheduled_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    completed_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    acknowledged_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    vendor_routed_at: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
    quote_deadline: null,
    selected_vendor_id: MOCK_USERS.vendor.id,
    selected_quote_id: 'quote-003',
    po_id: 'po-003',
    visibility: 'invited' as const,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    property: {
      id: 'prop-003',
      title: 'Ocean View Villa',
      address: '78 Beach Road',
      city: 'Durban',
    },
    tenant: {
      id: 'tenant-002',
      full_name: 'David Mthembu',
      avatar_url: null,
      email: 'david@example.com',
      phone: '+27 85 456 7890',
    },
    category: {
      id: 'cat-garden',
      name: 'Garden & Exterior',
      description: 'Garden, landscaping, and exterior maintenance',
    },
  },
];

// Helper to get requests by role
export function getMockMaintenanceRequests(userId: string, role: 'owner' | 'tenant' | 'vendor') {
  if (role === 'owner') {
    return MOCK_MAINTENANCE_REQUESTS.filter(r => r.owner_id === userId);
  }
  if (role === 'tenant') {
    return MOCK_MAINTENANCE_REQUESTS.filter(r => r.tenant_id === userId);
  }
  if (role === 'vendor') {
    return MOCK_MAINTENANCE_REQUESTS.filter(r => r.vendor_id === userId);
  }
  return [];
}

// Tenant-Property Relationships (Tenancies/Leases)
export const MOCK_TENANCIES = [
  {
    id: 'tenancy-001',
    tenant_id: MOCK_USERS.tenant.id,
    property_id: 'prop-001',
    unit_number: '3B',
    lease_start: '2024-01-01',
    lease_end: '2025-12-31',
    rent_amount: 8500,
    status: 'active' as const,
  },
  // Example: Tenant renting multiple properties (uncomment to test multi-property)
  // {
  //   id: 'tenancy-002',
  //   tenant_id: MOCK_USERS.tenant.id,
  //   property_id: 'prop-002',
  //   unit_number: '5A',
  //   lease_start: '2024-06-01',
  //   lease_end: '2025-05-31',
  //   rent_amount: 12000,
  //   status: 'active' as const,
  // },
];

// Helper to get tenant's properties
export function getTenantProperties(tenantId: string) {
  return MOCK_TENANCIES.filter(t => t.tenant_id === tenantId && t.status === 'active');
}

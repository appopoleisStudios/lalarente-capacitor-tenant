/** Row shape returned by admin_get_properties RPC */
export interface PropertyRow {
  id: string;
  title: string;
  city: string;
  rent_amount: number | null;
  status: string;
  created_at: string;
  owner_name: string | null;
}

/** Row shape returned by admin_get_leases RPC */
export interface LeaseRow {
  id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  status: string;
  deposit_amount: number | null;
  owner_name: string | null;
  tenant_name: string | null;
}

/** Row shape returned by admin_get_maintenance RPC */
export interface MaintenanceRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  estimated_cost: number | null;
  owner_name: string | null;
  tenant_name: string | null;
}

/** Row shape returned by admin_get_users RPC */
export interface UserRow {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  dev_admin: boolean;
  verification_status: boolean | null;
  created_at: string | null;
}

/** Shape returned by admin_get_dashboard_stats RPC */
export interface DashboardStats {
  total_users: number;
  total_properties: number;
  total_leases: number;
  active_leases: number;
  maintenance_open: number;
  monthly_revenue: number;
  total_disputes: number;
  total_arrears: number;
}

/** Shape returned by admin_get_payment_stats RPC */
export interface PaymentStats {
  total_payments: number;
  paid_payments: number;
  overdue_payments: number;
  active_disputes: number;
  total_arrears: number;
}

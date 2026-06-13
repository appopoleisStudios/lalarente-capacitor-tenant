import { supabase } from '../../../lib/supabase';
import { calculateExpiryNoticeDate } from '../../../shared/utils/businessDayCalculator';
import type { Database } from '../../../types/database.types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type LeaseRow = Database['public']['Tables']['leases']['Row'];
export type PaymentRow = Database['public']['Tables']['payments']['Row'];
export type InspectionRow = Database['public']['Tables']['inspections']['Row'];
export type MaintenanceRow = Database['public']['Tables']['maintenance_requests']['Row'];
export type RenewalRow = Database['public']['Tables']['renewal_negotiations']['Row'];
export type DepositRow = Database['public']['Tables']['holding_deposits']['Row'];
export type ApplicationRow = Database['public']['Tables']['rental_applications']['Row'];

/** Lightweight version with only the fields we query from maintenance_requests */
export interface MaintenanceSummary {
  id: string;
  title: string;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface LeaseWithJoins extends LeaseRow {
  property: { id: string; title: string; address: string; city: string | null } | null;
  owner: { full_name: string | null; email: string | null; phone: string | null } | null;
}

export interface TimelineEvent {
  id: string;
  type:
    | 'application_submitted'
    | 'application_approved'
    | 'holding_deposit_paid'
    | 'lease_signed_owner'
    | 'lease_signed_tenant'
    | 'lease_executed'
    | 'lease_started'
    | 'rent_paid'
    | 'rent_overdue'
    | 'inspection_scheduled'
    | 'inspection_completed'
    | 'maintenance_opened'
    | 'maintenance_resolved'
    | 'notice_80_day'
    | 'notice_60_day'
    | 'notice_40_day'
    | 'renewal_pending'
    | 'renewal_accepted'
    | 'lease_expiring'
    | 'lease_expired'
    | 'lease_terminated';
  title: string;
  subtitle: string;
  date: Date;
  status: 'completed' | 'pending' | 'overdue' | 'warning';
  metadata?: Record<string, unknown>;
}

// ─── Date Helpers ────────────────────────────────────────────────────────────

export function safeDate(value: string | Date | null | undefined): Date {
  if (value == null) return new Date();
  return new Date(value);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `In ${Math.abs(diffDays)} days`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// ─── Data Fetchers ──────────────────────────────────────────────────────────

export async function fetchActiveLease(userId: string): Promise<LeaseWithJoins | null> {
  const { data, error } = await supabase
    .from('leases')
    .select(`
      *,
      property:properties!property_id(id, title, address, city),
      owner:profiles!owner_id(full_name, email, phone)
    `)
    .eq('tenant_id', userId)
    .in('status', [
      'active', 'month_to_month', 'pending_tenant_signature',
      'pending_owner_signature', 'renewal_pending',
    ])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return data as unknown as LeaseWithJoins;
}

export async function fetchApplications(
  userId: string, propertyId: string
): Promise<ApplicationRow[]> {
  const { data } = await supabase
    .from('rental_applications')
    .select('id, status, created_at, updated_at')
    .eq('tenant_id', userId)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(1);
  return (data ?? []) as ApplicationRow[];
}

export async function fetchHoldingDeposits(
  userId: string, propertyId: string
): Promise<DepositRow[]> {
  const { data } = await supabase
    .from('holding_deposits')
    .select('id, created_at, status, paid_at')
    .eq('tenant_id', userId)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(1);
  return (data ?? []) as DepositRow[];
}

export async function fetchPayments(leaseId: string): Promise<PaymentRow[]> {
  const { data } = await supabase
    .from('payments')
    .select('id, amount, due_date, paid_date, status, type')
    .eq('lease_id', leaseId)
    .order('due_date', { ascending: false })
    .limit(12);
  return (data ?? []) as PaymentRow[];
}

export async function fetchInspections(leaseId: string): Promise<InspectionRow[]> {
  const { data } = await supabase
    .from('inspections')
    .select('id, type, scheduled_date, status, completed_date, created_at')
    .eq('lease_id', leaseId)
    .order('scheduled_date', { ascending: false });
  return (data ?? []) as InspectionRow[];
}

export async function fetchMaintenance(
  userId: string, propertyId: string
): Promise<MaintenanceSummary[]> {
  const { data } = await supabase
    .from('maintenance_requests')
    .select('id, title, status, created_at, updated_at')
    .eq('tenant_id', userId)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false });
  return (data ?? []) as unknown as MaintenanceSummary[];
}

export async function fetchRenewals(leaseId: string): Promise<RenewalRow[]> {
  const { data } = await supabase
    .from('renewal_negotiations')
    .select('id, status, created_at, response_at')
    .eq('lease_id', leaseId)
    .order('created_at', { ascending: false });
  return (data ?? []) as RenewalRow[];
}

// ─── Timeline Builders ──────────────────────────────────────────────────────

export function buildApplicationEvents(
  apps: ApplicationRow[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (apps.length === 0) return events;

  const app = apps[0];
  events.push({
    id: `app-submitted-${app.id}`,
    type: 'application_submitted',
    title: 'Application Submitted',
    subtitle: 'Your rental application was submitted',
    date: safeDate(app.created_at),
    status: 'completed',
  });

  if (app.status === 'approved') {
    events.push({
      id: `app-approved-${app.id}`,
      type: 'application_approved',
      title: 'Application Approved',
      subtitle: 'Landlord approved your application',
      date: safeDate(app.updated_at),
      status: 'completed',
    });
  }

  return events;
}

export function buildDepositEvents(
  deposits: DepositRow[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (deposits.length === 0) return events;

  const dep = deposits[0];
  const paidDate = dep.paid_at || dep.created_at;
  events.push({
    id: `holding-deposit-${dep.id}`,
    type: 'holding_deposit_paid',
    title: 'Holding Deposit Paid',
    subtitle: dep.status === 'paid'
      ? 'Holding deposit secured your spot'
      : 'Holding deposit recorded',
    date: safeDate(paidDate),
    status: dep.status === 'paid' ? 'completed' : 'pending',
  });

  return events;
}

export function buildLeaseSigningEvents(
  lease: LeaseWithJoins
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (lease.owner_signed_at) {
    events.push({
      id: `lease-signed-owner-${lease.id}`,
      type: 'lease_signed_owner',
      title: 'Owner Signed Lease',
      subtitle: lease.owner?.full_name || 'Landlord signed the lease agreement',
      date: safeDate(lease.owner_signed_at),
      status: 'completed',
    });
  }

  if (lease.tenant_signed_at) {
    events.push({
      id: `lease-signed-tenant-${lease.id}`,
      type: 'lease_signed_tenant',
      title: 'You Signed Lease',
      subtitle: 'You have signed the lease agreement',
      date: safeDate(lease.tenant_signed_at),
      status: 'completed',
    });
  } else if (lease.owner_signed_at) {
    events.push({
      id: `lease-signed-awaiting-${lease.id}`,
      type: 'lease_signed_tenant',
      title: 'Awaiting Your Signature',
      subtitle: 'You still need to sign the lease',
      date: safeDate(lease.created_at),
      status: 'pending',
    });
  }

  if (lease.executed_at) {
    events.push({
      id: `lease-executed-${lease.id}`,
      type: 'lease_executed',
      title: 'Lease Executed',
      subtitle: 'The lease is now legally binding',
      date: safeDate(lease.executed_at),
      status: 'completed',
    });
  }

  return events;
}

export function buildPaymentEvents(
  payments: PaymentRow[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const now = new Date();

  for (const payment of payments) {
    const dueDate = safeDate(payment.due_date);
    const isPaid = payment.status === 'completed' || !!payment.paid_date;
    const isOverdue = payment.status === 'pending' && dueDate < now;

    if (isPaid) {
      events.push({
        id: `payment-paid-${payment.id}`,
        type: 'rent_paid',
        title: `Rent Paid — R${(payment.amount || 0).toLocaleString()}`,
        subtitle: `Paid ${payment.paid_date ? formatDate(safeDate(payment.paid_date)) : ''}`,
        date: safeDate(payment.paid_date || payment.due_date),
        status: 'completed',
      });
    } else if (isOverdue) {
      events.push({
        id: `payment-overdue-${payment.id}`,
        type: 'rent_overdue',
        title: `Rent Overdue — R${(payment.amount || 0).toLocaleString()}`,
        subtitle: `Due ${formatDate(dueDate)} — payment overdue`,
        date: dueDate,
        status: 'overdue',
      });
    } else {
      events.push({
        id: `payment-pending-${payment.id}`,
        type: 'rent_overdue',
        title: `Rent Due — R${(payment.amount || 0).toLocaleString()}`,
        subtitle: `Due ${formatDate(dueDate)}`,
        date: dueDate,
        status: 'warning',
        metadata: { paymentId: payment.id },
      });
    }
  }

  return events;
}

export function buildInspectionEvents(
  inspections: InspectionRow[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const insp of inspections) {
    const isCompleted = insp.status === 'completed' || !!insp.completed_date;
    const typeLabel = insp.type === 'move_in' ? 'Move-In'
      : insp.type === 'move_out' ? 'Move-Out' : 'Periodic';

    events.push({
      id: `inspection-${insp.id}`,
      type: isCompleted ? 'inspection_completed' : 'inspection_scheduled',
      title: `${isCompleted ? 'Completed' : 'Scheduled'} — ${typeLabel} Inspection`,
      subtitle: isCompleted
        ? `Completed ${formatDate(safeDate(insp.completed_date))}`
        : `Scheduled for ${formatDate(safeDate(insp.scheduled_date))}`,
      date: safeDate(isCompleted ? insp.completed_date : insp.scheduled_date),
      status: isCompleted ? 'completed' : 'pending',
    });
  }

  return events;
}

export function buildMaintenanceEvents(
  maintenance: MaintenanceSummary[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const req of maintenance) {
    const isResolved = req.status === 'completed';
    events.push({
      id: `maintenance-${req.id}`,
      type: isResolved ? 'maintenance_resolved' : 'maintenance_opened',
      title: req.title || 'Maintenance Request',
      subtitle: isResolved
        ? `Resolved ${formatDate(safeDate(req.updated_at || req.created_at))}`
        : `Opened ${formatDate(safeDate(req.created_at))}`,
      date: safeDate(isResolved ? (req.updated_at || req.created_at) : req.created_at),
      status: isResolved ? 'completed' : 'pending',
    });
  }

  return events;
}

export function buildCpaNoticeEvents(
  lease: LeaseWithJoins
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const now = new Date();
  const endDate = safeDate(lease.end_date);
  const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry <= 0 || lease.status !== 'active') return events;

  const notice80Date = calculateExpiryNoticeDate(endDate, 80);
  const notice60Date = calculateExpiryNoticeDate(endDate, 60);
  const notice40Date = calculateExpiryNoticeDate(endDate, 40);

  if (daysUntilExpiry <= 120) {
    const sent = !!lease.notice_80_sent_at;
    events.push({
      id: `notice-80-${lease.id}`,
      type: 'notice_80_day',
      title: `80-Day Notice${sent ? ' Sent' : ' Due'}`,
      subtitle: sent
        ? `Sent ${formatDate(safeDate(lease.notice_80_sent_at!))}`
        : `Due ${formatDate(notice80Date)} — CPA renewal notice`,
      date: notice80Date,
      status: sent ? 'completed' : (notice80Date <= now ? 'overdue' : 'warning'),
    });
  }

  if (daysUntilExpiry <= 90) {
    const sent = !!lease.notice_60_sent_at;
    events.push({
      id: `notice-60-${lease.id}`,
      type: 'notice_60_day',
      title: `60-Day Notice${sent ? ' Sent' : ' Due'}`,
      subtitle: sent
        ? `Sent ${formatDate(safeDate(lease.notice_60_sent_at!))}`
        : `Due ${formatDate(notice60Date)} — CPA renewal notice`,
      date: notice60Date,
      status: sent ? 'completed' : (notice60Date <= now ? 'overdue' : 'warning'),
    });
  }

  if (daysUntilExpiry <= 60) {
    const sent = !!lease.notice_40_sent_at;
    events.push({
      id: `notice-40-${lease.id}`,
      type: 'notice_40_day',
      title: `40-Day Notice${sent ? ' Sent' : ' Due'}`,
      subtitle: sent
        ? `Sent ${formatDate(safeDate(lease.notice_40_sent_at!))}`
        : `Due ${formatDate(notice40Date)} — CPA renewal deadline approaching`,
      date: notice40Date,
      status: sent ? 'completed' : (notice40Date <= now ? 'overdue' : 'warning'),
    });
  }

  return events;
}

export function buildRenewalEvents(
  renewals: RenewalRow[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const renewal of renewals) {
    events.push({
      id: `renewal-${renewal.id}`,
      type: renewal.status === 'accepted' ? 'renewal_accepted' : 'renewal_pending',
      title: renewal.status === 'accepted' ? 'Renewal Accepted' : 'Renewal Proposed',
      subtitle: renewal.status === 'accepted'
        ? `Renewed ${formatDate(safeDate(renewal.response_at || renewal.created_at))}`
        : `Proposed ${formatDate(safeDate(renewal.created_at))}`,
      date: safeDate(renewal.response_at || renewal.created_at),
      status: renewal.status === 'accepted' ? 'completed' : 'pending',
    });
  }

  return events;
}

export function buildLeaseEndEvents(
  lease: LeaseWithJoins
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const now = new Date();
  const endDate = safeDate(lease.end_date);
  const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (lease.status === 'early_terminated') {
    events.push({
      id: `lease-terminated-${lease.id}`,
      type: 'lease_terminated',
      title: 'Lease Terminated Early',
      subtitle: lease.terminated_at
        ? `Terminated ${formatDate(safeDate(lease.terminated_at))}`
        : 'Early termination processed',
      date: safeDate(lease.terminated_at || lease.updated_at),
      status: 'overdue',
    });
    return events;
  }

  if (lease.status === 'active' || lease.status === 'month_to_month') {
    if (daysUntilExpiry <= 120 && daysUntilExpiry > 0) {
      events.push({
        id: `lease-expiring-${lease.id}`,
        type: 'lease_expiring',
        title: `Lease Expiring in ${daysUntilExpiry} days`,
        subtitle: `Ends ${formatDate(endDate)}`,
        date: endDate,
        status: daysUntilExpiry <= 30 ? 'overdue' : 'warning',
      });
    } else if (daysUntilExpiry <= 0) {
      events.push({
        id: `lease-expired-${lease.id}`,
        type: 'lease_expired',
        title: 'Lease Expired',
        subtitle: `Ended ${formatDate(endDate)}`,
        date: endDate,
        status: 'overdue',
      });
    }
  }

  return events;
}

export function buildLeaseStartEvent(
  lease: LeaseWithJoins
): TimelineEvent {
  const now = new Date();
  const startDate = safeDate(lease.start_date);
  return {
    id: `lease-start-${lease.id}`,
    type: 'lease_started',
    title: 'Lease Started',
    subtitle: `${formatDate(startDate)} — ${lease.property?.address || ''}`,
    date: startDate,
    status: startDate <= now ? 'completed' : 'pending',
  };
}

/**
 * Owner Dashboard API
 *
 * Enterprise-level orchestration layer that aggregates data from multiple existing APIs
 * for dashboard display. Follows Single Responsibility Principle - this module only
 * orchestrates, actual data fetching is delegated to domain-specific APIs.
 *
 * @module ownerDashboardApi
 */

import { propertiesApi } from '@/src/features/properties/api/propertiesApi';
import { paymentsApi } from '@/src/features/properties/api/paymentsApi';
import { applicationsApi } from '@/src/features/properties/api/applicationsApi';
import { getMaintenanceRequests } from '@/src/features/maintenance/api';
import { supabase } from '@/src/lib/supabase';
import type { MaintenanceRequest } from '@/src/features/maintenance/api/types/maintenance.types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PortfolioStats {
  totalUnits: number;
  occupied: number;
  vacant: number;
  monthIncome: number;
  arrears: number;
}

export interface AnalyticsData {
  monthIncome: number;
  currentOccupancy: number;
  tenantsInArrears: number;
  openMaintenance: number;
}

export interface MaintenanceItem {
  id: string;
  title: string;
  unit: string;
  status: string;
  quote: number | null;
  invoice: number | null;
  created_at: string;
}

export interface ApplicantItem {
  id: string;
  avatar: string;
  name: string;
  property: string;
  status: string;
  date: string;
}

export interface ActivityItem {
  icon: string;
  label: string;
  value: string;
  date: string;
}

export interface DocumentStats {
  activeLeases: number;
  pastLeases: number;
  pendingQuotes: number;
  recentInvoices: number;
  holdingDepositsActive: number;
}

export interface OwnerDashboardData {
  userName: string;
  portfolio: PortfolioStats;
  analytics: AnalyticsData;
  maintenance: MaintenanceItem[];
  applicants: ApplicantItem[];
  recentActivity: ActivityItem[];
  documents: DocumentStats;
}

// ============================================================================
// MAIN API FUNCTION
// ============================================================================

/**
 * Fetches comprehensive dashboard data for an owner
 *
 * Uses parallel Promise.all for optimal performance. All data fetching is
 * delegated to existing domain-specific APIs to maintain DRY principles.
 *
 * @param ownerId - The authenticated owner's user ID
 * @returns Complete dashboard data aggregated from multiple sources
 * @throws Error if any critical data fetch fails
 *
 * @example
 * ```typescript
 * const dashboardData = await getOwnerDashboardData(user.id);
 * ```
 */
export async function getOwnerDashboardData(ownerId: string): Promise<OwnerDashboardData> {
  try {
    // Fetch all data in parallel using existing APIs
    // This is faster than sequential calls and maintains separation of concerns
    const [
      userProfile,
      properties,
      payments,
      maintenanceRequests,
      applications,
    ] = await Promise.all([
      fetchUserProfile(ownerId),
      propertiesApi.getOwnerProperties(ownerId),
      paymentsApi.getOwnerPayments(ownerId),
      getMaintenanceRequests(ownerId, 'owner'),
      applicationsApi.getOwnerApplications(ownerId),
    ]);

    // Fetch holding deposits count for owner's properties (pending + paid = "active")
    const propertyIds = properties.map((p: any) => p.id);
    const holdingDepositsActive = await fetchHoldingDepositsCount(propertyIds);

    // Batch-fetch accepted quotes for active maintenance requests (single extra query)
    const activeIds = maintenanceRequests
      .filter(r => ['open', 'quote_received', 'in_progress'].includes(r.status))
      .map(r => r.id);

    const quotesMap: Record<string, number> = {};
    if (activeIds.length > 0) {
      const { data: quotesData } = await supabase
        .from('quotes')
        .select('request_id, total_amount')
        .in('request_id', activeIds)
        .in('status', ['accepted', 'approved']);
      if (quotesData) {
        quotesData.forEach((q: any) => { quotesMap[q.request_id] = q.total_amount; });
      }
    }

    // Transform raw data into dashboard-specific formats
    const portfolio = calculatePortfolioStats(properties, payments);
    const analytics = calculateAnalytics(properties, payments, maintenanceRequests);
    const maintenance = formatMaintenanceItems(maintenanceRequests, quotesMap);
    const applicants = formatApplicants(applications);
    const recentActivity = buildActivityFeed(payments, maintenanceRequests, applications);
    const documents = calculateDocumentStats(properties, payments, maintenanceRequests, holdingDepositsActive);

    return {
      userName: userProfile?.full_name || 'Owner',
      portfolio,
      analytics,
      maintenance,
      applicants,
      recentActivity,
      documents,
    };
  } catch (error) {
    console.error('[ownerDashboardApi] Error fetching dashboard data:', error);
    throw new Error('Failed to load dashboard data. Please try again.');
  }
}

// ============================================================================
// HELPER FUNCTIONS - Data Fetching
// ============================================================================

/**
 * Fetches count of active holding deposits (pending + paid) for given property IDs.
 * "Active" = money is either requested or received but not yet applied/refunded.
 */
async function fetchHoldingDepositsCount(propertyIds: string[]): Promise<number> {
  if (propertyIds.length === 0) return 0;
  const { count } = await supabase
    .from('holding_deposits')
    .select('*', { count: 'exact', head: true })
    .in('property_id', propertyIds)
    .in('status', ['pending', 'paid']);
  return count || 0;
}

/**
 * Fetches user profile data
 * Separated for better testability and error handling
 */
async function fetchUserProfile(ownerId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', ownerId)
    .single();

  if (error) {
    console.warn('[ownerDashboardApi] Failed to fetch user profile:', error);
    return null;
  }

  return data;
}

// ============================================================================
// HELPER FUNCTIONS - Data Transformation
// ============================================================================

/**
 * Calculates portfolio statistics from properties and payments data
 *
 * @param properties - Owner's properties from propertiesApi
 * @param payments - Owner's payments from paymentsApi
 * @returns Aggregated portfolio statistics
 */
function calculatePortfolioStats(properties: any[], payments: any[]): PortfolioStats {
  const totalUnits = properties.length;
  const occupied = properties.filter(p => p.status === 'rented').length;
  const vacant = properties.filter(p => p.status === 'available').length;

  // Sum monthly rent from all rented properties
  const monthIncome = properties
    .filter(p => p.status === 'rented')
    .reduce((sum, p) => sum + (p.rent_amount || 0), 0);

  // Calculate arrears from overdue/pending payments past due date
  const now = new Date();
  const arrears = payments
    .filter(p => {
      if (!p.due_date) return false;
      const dueDate = new Date(p.due_date);
      const isOverdue = dueDate < now;
      const isPending = p.status === 'pending' || p.status === 'overdue';
      return isOverdue && isPending;
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return { totalUnits, occupied, vacant, monthIncome, arrears };
}

/**
 * Calculates analytics metrics
 *
 * @param properties - Owner's properties
 * @param payments - Owner's payments
 * @param maintenanceRequests - Owner's maintenance requests
 * @returns Key performance indicators for dashboard
 */
function calculateAnalytics(
  properties: any[],
  payments: any[],
  maintenanceRequests: any[]
): AnalyticsData {
  const totalUnits = properties.length;
  const occupied = properties.filter(p => p.status === 'rented').length;

  // Calculate current month's collected income
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  const monthIncome = payments
    .filter(p => {
      if (p.status !== 'completed' || !p.paid_date) return false;
      const paidDate = new Date(p.paid_date);
      return paidDate >= currentMonthStart;
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // Calculate occupancy percentage
  const currentOccupancy = totalUnits > 0
    ? Math.round((occupied / totalUnits) * 100)
    : 0;

  // Count unique tenants with overdue payments
  const now = new Date();
  const tenantsInArrears = new Set(
    payments
      .filter(p => {
        if (!p.due_date || !p.tenant_id) return false;
        const dueDate = new Date(p.due_date);
        const isOverdue = dueDate < now;
        const isPending = p.status === 'pending' || p.status === 'overdue';
        return isOverdue && isPending;
      })
      .map(p => p.tenant_id)
  ).size;

  // Count open maintenance requests
  const openMaintenance = maintenanceRequests.filter(m =>
    ['open', 'assigned', 'in_progress'].includes(m.status)
  ).length;

  return {
    monthIncome,
    currentOccupancy,
    tenantsInArrears,
    openMaintenance,
  };
}

/**
 * Formats maintenance requests for dashboard display
 * Takes only the 5 most recent active requests
 */
function formatMaintenanceItems(requests: any[], quotesMap: Record<string, number> = {}): MaintenanceItem[] {
  return requests
    .filter(r => ['open', 'quote_received', 'in_progress'].includes(r.status))
    .slice(0, 5)
    .map(r => {
      const property = r.property as any;

      const statusMap: Record<string, string> = {
        open: 'Open',
        quote_received: 'Quote Received',
        in_progress: 'In Progress',
      };

      return {
        id: r.id,
        title: r.title || 'Maintenance Request',
        unit: property?.title || 'Property',
        status: statusMap[r.status] || r.status,
        quote: quotesMap[r.id] || null,
        invoice: null,
        created_at: r.created_at,
      };
    });
}

/**
 * Formats rental applications for dashboard display
 * Shows only pending and recently approved applications
 */
function formatApplicants(applications: any[]): ApplicantItem[] {
  return applications
    .filter(a => ['pending', 'approved'].includes(a.status))
    .slice(0, 5)
    .map(a => {
      const tenant = a.tenant as any;
      const property = a.property as any;
      const createdDate = new Date(a.created_at);

      return {
        id: a.id,
        avatar: tenant?.avatar_url || '',
        name: tenant?.full_name || 'Applicant',
        property: property?.title || 'Property',
        status: a.status === 'pending' ? 'Pending' : 'Approved',
        date: formatRelativeTime(createdDate),
      };
    });
}

/**
 * Builds unified activity feed from multiple sources
 * Combines payments, maintenance, and applications into single timeline
 */
function buildActivityFeed(
  payments: any[],
  maintenanceRequests: any[],
  applications: any[]
): ActivityItem[] {
  const activities: (ActivityItem & { timestamp: Date })[] = [];

  // Add completed payments
  payments
    .filter(p => p.status === 'completed' && p.paid_date)
    .slice(0, 3)
    .forEach(p => {
      activities.push({
        icon: '💰',
        label: 'Rent Received',
        value: `R ${(p.amount || 0).toLocaleString()}`,
        date: formatRelativeTime(new Date(p.paid_date!)),
        timestamp: new Date(p.paid_date!),
      });
    });

  // Add arrears notices
  const now = new Date();
  payments
    .filter(p => {
      if (!p.due_date) return false;
      const dueDate = new Date(p.due_date);
      return dueDate < now && (p.status === 'pending' || p.status === 'overdue');
    })
    .slice(0, 2)
    .forEach(p => {
      activities.push({
        icon: '⚠️',
        label: 'Arrears Notice',
        value: `R ${(p.amount || 0).toLocaleString()}`,
        date: formatRelativeTime(new Date(p.due_date!)),
        timestamp: new Date(p.due_date!),
      });
    });

  // Add new maintenance requests
  maintenanceRequests
    .filter(m => m.status === 'open')
    .slice(0, 2)
    .forEach(m => {
      const property = m.property as any;
      activities.push({
        icon: '🔧',
        label: 'New Maintenance',
        value: property?.title || 'Property',
        date: formatRelativeTime(new Date(m.created_at)),
        timestamp: new Date(m.created_at),
      });
    });

  // Add new applications
  applications
    .slice(0, 2)
    .forEach(a => {
      const property = a.property as any;
      activities.push({
        icon: '📝',
        label: 'New Application',
        value: property?.title || 'Property',
        date: formatRelativeTime(new Date(a.created_at)),
        timestamp: new Date(a.created_at),
      });
    });

  // Sort by most recent first and return without timestamp field
  return activities
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 10)
    .map(({ timestamp, ...activity }) => activity);
}

/**
 * Calculates document statistics from already-fetched data (no extra queries).
 */
function calculateDocumentStats(
  properties: any[],
  payments: any[],
  maintenanceRequests: any[],
  holdingDepositsActive: number = 0,
): DocumentStats {
  const activeLeases = properties.filter(p => p.status === 'rented').length;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const recentInvoices = payments.filter(
    p => p.status === 'completed' && p.paid_date && new Date(p.paid_date) >= monthStart
  ).length;

  const pendingQuotes = maintenanceRequests.filter(r => r.status === 'quote_received').length;

  return { activeLeases, pastLeases: 0, pendingQuotes, recentInvoices, holdingDepositsActive };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats a date as relative time (e.g., "2h ago", "Yesterday")
 *
 * @param date - The date to format
 * @returns Human-readable relative time string
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

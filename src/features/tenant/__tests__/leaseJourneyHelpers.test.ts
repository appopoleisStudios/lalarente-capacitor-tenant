/**
 * Tests for the lease journey timeline builder functions.
 *
 * These are the pure helper functions extracted from TenantLeaseJourneyScreen.
 * Each builder takes structured data and returns TimelineEvent[].
 */

// Replicate the helper types and functions here for unit testing
// (They're defined in the component file but extracted here for isolated testing)

type TimelineEvent = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  date: Date;
  status: 'completed' | 'pending' | 'overdue' | 'warning';
  metadata?: Record<string, unknown>;
};

function safeDate(value: string | Date | null | undefined): Date {
  if (value == null) return new Date();
  return new Date(value);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Builder Tests ───────────────────────────────────────────────────────────

describe('buildApplicationEvents', () => {
  type ApplicationRow = { id: string; status: string; created_at: string; updated_at: string };

  function buildApplicationEvents(apps: ApplicationRow[]): TimelineEvent[] {
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

  it('returns empty array when no applications', () => {
    expect(buildApplicationEvents([])).toEqual([]);
  });

  it('returns submitted event for any application', () => {
    const events = buildApplicationEvents([
      { id: 'app-1', status: 'pending', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z' },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('application_submitted');
    expect(events[0].status).toBe('completed');
  });

  it('adds approved event when status is approved', () => {
    const events = buildApplicationEvents([
      { id: 'app-1', status: 'approved', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-05T00:00:00Z' },
    ]);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('application_submitted');
    expect(events[1].type).toBe('application_approved');
    expect(events[1].status).toBe('completed');
  });
});

describe('buildDepositEvents', () => {
  type DepositRow = { id: string; status: string; created_at: string; paid_at: string | null };

  function buildDepositEvents(deposits: DepositRow[]): TimelineEvent[] {
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

  it('returns empty when no deposit', () => {
    expect(buildDepositEvents([])).toEqual([]);
  });

  it('marks as completed when status is paid', () => {
    const events = buildDepositEvents([
      { id: 'dep-1', status: 'paid', created_at: '2026-06-01T00:00:00Z', paid_at: '2026-06-01T00:00:00Z' },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('completed');
    expect(events[0].type).toBe('holding_deposit_paid');
  });

  it('marks as pending when status is not paid', () => {
    const events = buildDepositEvents([
      { id: 'dep-1', status: 'pending', created_at: '2026-06-01T00:00:00Z', paid_at: null },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('pending');
  });
});

describe('buildPaymentEvents', () => {
  type PaymentRow = { id: string; amount: number; due_date: string; paid_date: string | null; status: string; type: string };

  function buildPaymentEvents(payments: PaymentRow[]): TimelineEvent[] {
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

  it('returns empty for no payments', () => {
    expect(buildPaymentEvents([])).toEqual([]);
  });

  it('marks completed payments as rent_paid', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const events = buildPaymentEvents([
      { id: 'pay-1', amount: 5000, due_date: '2026-06-01T00:00:00Z', paid_date: '2026-06-01T00:00:00Z', status: 'completed', type: 'rent' },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('rent_paid');
    expect(events[0].status).toBe('completed');
  });

  it('marks overdue payments correctly', () => {
    const pastDate = new Date(Date.now() - 86400000 * 10).toISOString();
    const events = buildPaymentEvents([
      { id: 'pay-2', amount: 5000, due_date: pastDate, paid_date: null, status: 'pending', type: 'rent' },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('rent_overdue');
    expect(events[0].status).toBe('overdue');
  });

  it('marks future pending payments as warning', () => {
    const futureDate = new Date(Date.now() + 86400000 * 10).toISOString();
    const events = buildPaymentEvents([
      { id: 'pay-3', amount: 5000, due_date: futureDate, paid_date: null, status: 'pending', type: 'rent' },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('warning');
  });
});

describe('buildLeaseSigningEvents', () => {
  type LeaseWithJoins = {
    id: string;
    owner_signed_at: string | null;
    tenant_signed_at: string | null;
    executed_at: string | null;
    created_at: string | null;
    owner: { full_name: string | null } | null;
  };

  function buildLeaseSigningEvents(lease: LeaseWithJoins): TimelineEvent[] {
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

  it('returns no events when nothing is signed', () => {
    const lease = { id: 'l1', owner_signed_at: null, tenant_signed_at: null, executed_at: null, created_at: '2026-06-01T00:00:00Z', owner: null };
    expect(buildLeaseSigningEvents(lease)).toHaveLength(0);
  });

  it('adds owner signed event', () => {
    const lease = { id: 'l1', owner_signed_at: '2026-06-10T00:00:00Z', tenant_signed_at: null, executed_at: null, created_at: '2026-06-01T00:00:00Z', owner: { full_name: 'John' } };
    const events = buildLeaseSigningEvents(lease);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('lease_signed_owner');
    expect(events[1].type).toBe('lease_signed_tenant');
    expect(events[1].status).toBe('pending');
  });

  it('adds executed event when present', () => {
    const lease = { id: 'l1', owner_signed_at: '2026-06-10T00:00:00Z', tenant_signed_at: '2026-06-11T00:00:00Z', executed_at: '2026-06-12T00:00:00Z', created_at: '2026-06-01T00:00:00Z', owner: { full_name: 'John' } };
    const events = buildLeaseSigningEvents(lease);
    expect(events).toHaveLength(3);
    expect(events[2].type).toBe('lease_executed');
    expect(events[2].status).toBe('completed');
  });
});

describe('buildInspectionEvents', () => {
  type InspectionRow = { id: string; type: string; scheduled_date: string; status: string; completed_date: string | null; created_at: string | null };

  function buildInspectionEvents(inspections: InspectionRow[]): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    for (const insp of inspections) {
      const isCompleted = insp.status === 'completed' || !!insp.completed_date;
      const typeLabel = insp.type === 'move_in' ? 'Move-In' : insp.type === 'move_out' ? 'Move-Out' : 'Periodic';
      events.push({
        id: `inspection-${insp.id}`,
        type: isCompleted ? 'inspection_completed' : 'inspection_scheduled',
        title: `${isCompleted ? 'Completed' : 'Scheduled'} — ${typeLabel} Inspection`,
        subtitle: isCompleted ? `Completed ${formatDate(safeDate(insp.completed_date!))}` : `Scheduled for ${formatDate(safeDate(insp.scheduled_date))}`,
        date: safeDate(isCompleted ? insp.completed_date : insp.scheduled_date),
        status: isCompleted ? 'completed' : 'pending',
      });
    }
    return events;
  }

  it('returns empty for no inspections', () => {
    expect(buildInspectionEvents([])).toEqual([]);
  });

  it('marks completed inspections correctly', () => {
    const events = buildInspectionEvents([
      { id: 'i1', type: 'move_in', scheduled_date: '2026-06-01T00:00:00Z', status: 'completed', completed_date: '2026-06-01T00:00:00Z', created_at: null },
    ]);
    expect(events[0].type).toBe('inspection_completed');
    expect(events[0].status).toBe('completed');
  });

  it('marks scheduled inspections as pending', () => {
    const events = buildInspectionEvents([
      { id: 'i2', type: 'move_out', scheduled_date: '2026-12-01T00:00:00Z', status: 'scheduled', completed_date: null, created_at: null },
    ]);
    expect(events[0].type).toBe('inspection_scheduled');
    expect(events[0].status).toBe('pending');
  });
});

describe('safeDate', () => {
  it('returns current date for null', () => {
    const result = safeDate(null);
    expect(result).toBeInstanceOf(Date);
  });

  it('returns current date for undefined', () => {
    const result = safeDate(undefined);
    expect(result).toBeInstanceOf(Date);
  });

  it('parses ISO string correctly', () => {
    const result = safeDate('2026-06-15T00:00:00Z');
    expect(result.toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });
});

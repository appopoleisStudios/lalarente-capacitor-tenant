/**
 * Tests for the lease journey timeline builder functions.
 *
 * Imports from the production utils file so tests cover the actual
 * implementation used by TenantLeaseJourneyScreen.
 */

import {
  safeDate,
  formatDate,
  buildApplicationEvents,
  buildDepositEvents,
  buildPaymentEvents,
  buildLeaseSigningEvents,
  buildInspectionEvents,
  type ApplicationRow,
  type DepositRow,
  type PaymentRow,
  type InspectionRow,
  type LeaseWithJoins,
  type TimelineEvent,
} from '../utils/leaseJourneyHelpers';

// ─── buildApplicationEvents ─────────────────────────────────────────────────

describe('buildApplicationEvents', () => {
  const makeApp = (overrides: Partial<ApplicationRow> = {}): ApplicationRow => ({
    id: 'app-1',
    status: 'pending',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    tenant_id: 't1',
    property_id: 'p1',
    owner_id: 'o1',
    ...overrides,
  });

  it('returns empty array when no applications', () => {
    expect(buildApplicationEvents([])).toEqual([]);
  });

  it('returns submitted event for any application', () => {
    const events = buildApplicationEvents([makeApp()]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('application_submitted');
    expect(events[0].status).toBe('completed');
  });

  it('adds approved event when status is approved', () => {
    const events = buildApplicationEvents([
      makeApp({ status: 'approved', updated_at: '2026-06-05T00:00:00Z' }),
    ]);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('application_submitted');
    expect(events[1].type).toBe('application_approved');
    expect(events[1].status).toBe('completed');
  });
});

// ─── buildDepositEvents ─────────────────────────────────────────────────────

describe('buildDepositEvents', () => {
  const makeDep = (overrides: Partial<DepositRow> = {}): DepositRow => ({
    id: 'dep-1',
    status: 'paid',
    created_at: '2026-06-01T00:00:00Z',
    paid_at: '2026-06-01T00:00:00Z',
    tenant_id: 't1',
    property_id: 'p1',
    amount: 5000,
    application_id: null,
    applied_at: null,
    decision_deadline: null,
    forfeited_at: null,
    hold_expires_at: null,
    notes: null,
    payment_deadline: null,
    payment_method: null,
    payment_reference: null,
    refund_reason: null,
    refunded_at: null,
    transaction_id: null,
    updated_at: null,
    ...overrides,
  });

  it('returns empty when no deposit', () => {
    expect(buildDepositEvents([])).toEqual([]);
  });

  it('marks as completed when status is paid', () => {
    const events = buildDepositEvents([makeDep()]);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('completed');
    expect(events[0].type).toBe('holding_deposit_paid');
  });

  it('marks as pending when status is not paid', () => {
    const events = buildDepositEvents([makeDep({ status: 'pending', paid_at: null })]);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('pending');
  });
});

// ─── buildPaymentEvents ─────────────────────────────────────────────────────

describe('buildPaymentEvents', () => {
  const makePay = (overrides: Partial<PaymentRow> = {}): PaymentRow => ({
    id: 'pay-1',
    amount: 5000,
    due_date: '2026-06-01T00:00:00Z',
    paid_date: '2026-06-01T00:00:00Z',
    status: 'completed',
    type: 'rent',
    lease_id: 'l1',
    owner_id: 'o1',
    property_id: 'p1',
    tenant_id: 't1',
    created_at: null,
    updated_at: null,
    amount_outstanding: null,
    amount_paid: null,
    credit_balance: null,
    days_overdue: null,
    failure_reason: null,
    fee_paid_by: null,
    interest_amount: null,
    interest_calculated_at: null,
    last_retry_at: null,
    max_retry_count: null,
    next_retry_at: null,
    notes: null,
    original_amount: null,
    parent_payment_id: null,
    payment_gateway: null,
    payment_method: null,
    payment_variant: null,
    retry_count: null,
    transaction_fee: null,
    transaction_id: null,
    ...overrides,
  });

  it('returns empty for no payments', () => {
    expect(buildPaymentEvents([])).toEqual([]);
  });

  it('marks completed payments as rent_paid', () => {
    const events = buildPaymentEvents([makePay()]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('rent_paid');
    expect(events[0].status).toBe('completed');
  });

  it('marks overdue payments correctly', () => {
    const pastDate = new Date(Date.now() - 86400000 * 10).toISOString();
    const events = buildPaymentEvents([
      makePay({ status: 'pending', due_date: pastDate, paid_date: null }),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('rent_overdue');
    expect(events[0].status).toBe('overdue');
  });

  it('marks future pending payments as warning', () => {
    const futureDate = new Date(Date.now() + 86400000 * 10).toISOString();
    const events = buildPaymentEvents([
      makePay({ status: 'pending', due_date: futureDate, paid_date: null }),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('warning');
  });
});

// ─── buildLeaseSigningEvents ────────────────────────────────────────────────

describe('buildLeaseSigningEvents', () => {
  const makeLease = (overrides: Partial<LeaseWithJoins> = {}): LeaseWithJoins => ({
    id: 'l1',
    owner_signed_at: null,
    tenant_signed_at: null,
    executed_at: null,
    created_at: '2026-06-01T00:00:00Z',
    owner: null,
    property: null,
    status: 'active',
    start_date: '2026-06-01T00:00:00Z',
    end_date: '2027-06-01T00:00:00Z',
    rental_amount: 8500,
    tenant_id: 't1',
    owner_id: 'o1',
    property_id: 'p1',
    updated_at: null,
    application_id: null,
    auto_converted_to_mtm: null,
    converted_to_mtm_at: null,
    deposit_account_number: null,
    deposit_amount: null,
    deposit_bank_name: null,
    deposit_interest_rate: null,
    deposit_refund_amount: null,
    deposit_refund_deadline: null,
    deposit_refund_status: null,
    deposit_refunded_at: null,
    deposit_total_interest: null,
    document_template_id: null,
    early_termination_effective_date: null,
    early_termination_notice_period_days: null,
    early_termination_penalty: null,
    early_termination_reason: null,
    early_termination_requested_at: null,
    early_termination_requested_by: null,
    escalation_history: null,
    interest_on_arrears_rate: null,
    last_escalation_amount: null,
    last_escalation_date: null,
    lease_document_url: null,
    lease_type: null,
    next_escalation_date: null,
    notice_40_sent_at: null,
    notice_60_sent_at: null,
    notice_80_sent_at: null,
    original_lease_id: null,
    owner_signature_url: null,
    payment_due_day: null,
    renewal_count: null,
    rent_escalation_frequency_months: null,
    rent_escalation_type: null,
    rent_escalation_value: null,
    tenant_renewal_response: null,
    tenant_response_at: null,
    tenant_signature_url: null,
    terminated_at: null,
    ...overrides,
  });

  it('returns no events when nothing is signed', () => {
    expect(buildLeaseSigningEvents(makeLease())).toHaveLength(0);
  });

  it('adds owner signed event and pending tenant event', () => {
    const events = buildLeaseSigningEvents(
      makeLease({ owner_signed_at: '2026-06-10T00:00:00Z' })
    );
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('lease_signed_owner');
    expect(events[1].type).toBe('lease_signed_tenant');
    expect(events[1].status).toBe('pending');
  });

  it('adds executed event when present', () => {
    const events = buildLeaseSigningEvents(
      makeLease({
        owner_signed_at: '2026-06-10T00:00:00Z',
        tenant_signed_at: '2026-06-11T00:00:00Z',
        executed_at: '2026-06-12T00:00:00Z',
      })
    );
    expect(events).toHaveLength(3);
    expect(events[2].type).toBe('lease_executed');
    expect(events[2].status).toBe('completed');
  });
});

// ─── buildInspectionEvents ──────────────────────────────────────────────────

describe('buildInspectionEvents', () => {
  const makeInsp = (overrides: Partial<InspectionRow> = {}): InspectionRow => ({
    id: 'i1',
    type: 'move_in',
    scheduled_date: '2026-06-01T00:00:00Z',
    status: 'completed',
    completed_date: '2026-06-01T00:00:00Z',
    created_at: null,
    updated_at: null,
    lease_id: null,
    owner_id: 'o1',
    property_id: 'p1',
    tenant_id: 't1',
    inspector_id: null,
    notes: null,
    overall_condition: null,
    owner_signature_url: null,
    owner_signed_at: null,
    report_url: null,
    rooms: {},
    tenant_signature_url: null,
    tenant_signed_at: null,
    ...overrides,
  });

  it('returns empty for no inspections', () => {
    expect(buildInspectionEvents([])).toEqual([]);
  });

  it('marks completed inspections correctly', () => {
    const events = buildInspectionEvents([makeInsp()]);
    expect(events[0].type).toBe('inspection_completed');
    expect(events[0].status).toBe('completed');
  });

  it('marks scheduled inspections as pending', () => {
    const events = buildInspectionEvents([
      makeInsp({ status: 'scheduled', completed_date: null }),
    ]);
    expect(events[0].type).toBe('inspection_scheduled');
    expect(events[0].status).toBe('pending');
  });
});

// ─── safeDate ────────────────────────────────────────────────────────────────

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

/**
 * Tests for arrears escalation logic.
 *
 * Tests the exported pure helpers from arrearsEscalation.api.ts:
 * - determineEscalationStage(daysOverdue)
 * - isDowngrade(currentStage, newStage)
 * - calculateDaysOverdue(dueDate)
 *
 * Legal framework: CPA s14 arrears process
 * - 7 days: Friendly reminder
 * - 14 days: Formal demand
 * - 21 days: Breach notice + 20 business day cure period
 */

import {
  determineEscalationStage,
  isDowngrade,
  calculateDaysOverdue,
} from '../arrearsEscalation.api';

// ─── calculateDaysOverdue ────────────────────────────────────────────────────

describe('calculateDaysOverdue', () => {
  it('returns positive days for a past due date', () => {
    // Due date 30 days ago
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const days = calculateDaysOverdue(past);
    expect(days).toBeGreaterThanOrEqual(29);
    expect(days).toBeLessThanOrEqual(31);
  });

  it('returns negative days for a future due date', () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const days = calculateDaysOverdue(future);
    expect(days).toBeLessThan(0);
  });

  it('returns ~0 for today', () => {
    const today = new Date().toISOString();
    const days = calculateDaysOverdue(today);
    expect(days >= 0 && days <= 1).toBe(true);
  });
});

// ─── determineEscalationStage ────────────────────────────────────────────────

describe('determineEscalationStage', () => {
  it('returns null when below minimum threshold (0 days)', () => {
    expect(determineEscalationStage(0)).toBeNull();
  });

  it('returns null when below minimum threshold (6 days)', () => {
    expect(determineEscalationStage(6)).toBeNull();
  });

  it('returns "friendly_reminder" for 7-13 days overdue', () => {
    expect(determineEscalationStage(7)).toBe('friendly_reminder');
    expect(determineEscalationStage(10)).toBe('friendly_reminder');
    expect(determineEscalationStage(13)).toBe('friendly_reminder');
  });

  it('returns "formal_demand" for 14-20 days overdue', () => {
    expect(determineEscalationStage(14)).toBe('formal_demand');
    expect(determineEscalationStage(17)).toBe('formal_demand');
    expect(determineEscalationStage(20)).toBe('formal_demand');
  });

  it('returns "breach_notice" for 21+ days overdue', () => {
    expect(determineEscalationStage(21)).toBe('breach_notice');
    expect(determineEscalationStage(30)).toBe('breach_notice');
    expect(determineEscalationStage(90)).toBe('breach_notice');
  });
});

// ─── isDowngrade ─────────────────────────────────────────────────────────────

describe('isDowngrade', () => {
  it('returns true when new stage is lower in order', () => {
    // Moving from breach_notice to formal_demand is a downgrade
    expect(isDowngrade('breach_notice', 'formal_demand')).toBe(true);
    expect(isDowngrade('formal_demand', 'friendly_reminder')).toBe(true);
    expect(isDowngrade('legal_action', 'breach_notice')).toBe(true);
  });

  it('returns false when new stage is same or higher', () => {
    expect(isDowngrade('friendly_reminder', 'formal_demand')).toBe(false);
    expect(isDowngrade('friendly_reminder', 'breach_notice')).toBe(false);
    expect(isDowngrade('formal_demand', 'formal_demand')).toBe(false);
    expect(isDowngrade('cure_period', 'legal_action')).toBe(false);
  });

  it('returns true when moving from cure_period to friendly_reminder', () => {
    expect(isDowngrade('cure_period', 'friendly_reminder')).toBe(true);
  });
});

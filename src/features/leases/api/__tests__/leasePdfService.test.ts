/**
 * Tests for lease PDF HTML generation.
 *
 * Tests the exported generateLeaseHTML() pure function from leasePdfService.ts.
 * The function takes a LeaseData fixture and returns an HTML string.
 *
 * Coverage:
 * - Document structure (DOCTYPE, title, sections)
 * - Schedule table (landlord, agent, tenant, premises, financial terms)
 * - Financial clauses (deposit, interest on arrears, escalation, late fee)
 * - Legal clauses (termination for fixed vs month-to-month)
 * - Signature section
 * - Conditional rendering (hide agent section, hide deposit, etc.)
 */

import { generateLeaseHTML, LeaseData } from '../leasePdfService';

// ─── Fixture ─────────────────────────────────────────────────────────────────

const fullFixture: LeaseData = {
  id: 'test-lease-001',
  property: {
    title: 'Sunset Villa',
    address: '12 Ocean Drive',
    city: 'Cape Town',
    province: 'Western Cape',
    postal_code: '8001',
  },
  owner: {
    full_name: 'John Owner',
    id_number: '8001015009088',
    email: 'john@owner.com',
    phone: '+27 82 123 4567',
  },
  tenant: {
    full_name: 'Jane Tenant',
    email: 'jane@tenant.com',
    phone: '+27 72 987 6543',
    id_number: '9001016009088',
    date_of_birth: '1990-01-01',
  },
  start_date: '2026-07-01',
  end_date: '2027-06-30',
  monthly_rent: 12500,
  deposit_amount: 12500,
  payment_due_day: 7,
  lease_type: 'fixed',
  late_fee_amount: 200,
  late_fee_grace_days: 3,
  interest_on_arrears_rate: 15.5,
  rent_escalation_type: 'percentage',
  rent_escalation_value: 8,
  rent_escalation_frequency_months: 12,
  owner_signature_url: null,
  tenant_signature_url: null,
  owner_signed_at: '2026-06-15',
  tenant_signed_at: '2026-06-16',
  executed_at: '2026-06-16',
  agency_name: 'Premier Realty SA',
  agency_reg_no: '2020/123456/07',
  agent_name: 'Sarah Agent',
  agent_phone: '+27 11 234 5678',
};

// Minimal fixture with null optionals (tests conditional rendering)
const minimalFixture: LeaseData = {
  id: 'test-lease-002',
  property: {
    title: 'City Loft',
    address: '5 Main Road',
    city: 'Johannesburg',
  },
  owner: {
    full_name: 'Alice Owner',
  },
  tenant: {
    full_name: 'Bob Tenant',
  },
  start_date: '2026-08-01',
  end_date: '2026-09-01',
  monthly_rent: 8500,
  deposit_amount: null,
  payment_due_day: null,
  lease_type: 'month_to_month',
  late_fee_amount: null,
  late_fee_grace_days: null,
  interest_on_arrears_rate: null,
  rent_escalation_type: null,
  rent_escalation_value: null,
  rent_escalation_frequency_months: null,
  owner_signature_url: null,
  tenant_signature_url: null,
  owner_signed_at: null,
  tenant_signed_at: null,
  executed_at: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function assertContains(html: string, needle: string, description: string): void {
  expect(html).toContain(needle);
}

function assertNotContains(html: string, needle: string, description: string): void {
  expect(html).not.toContain(needle);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('generateLeaseHTML', () => {
  describe('Document structure', () => {
    it('renders DOCTYPE and basic HTML structure', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, '<!DOCTYPE html>', 'DOCTYPE declaration');
      assertContains(html, '<title>Residential Lease Agreement</title>', 'Page title');
      assertContains(html, '</html>', 'Closing html tag');
    });

    it('includes the header with lease ID', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'RESIDENTIAL MANAGEMENT LEASE AGREEMENT', 'Agreement title');
      assertContains(html, 'test-lease-001', 'Lease ID in header');
    });
  });

  describe('Schedule table — Landlord details', () => {
    it('renders landlord full name', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'John Owner', 'Owner name');
    });

    it('renders landlord ID number when provided', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, '8001015009088', 'Owner ID number');
    });

    it('renders landlord email and phone when provided', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'john@owner.com', 'Owner email');
      assertContains(html, '+27 82 123 4567', 'Owner phone');
    });
  });

  describe('Schedule table — Managing Agent', () => {
    it('renders agent section when agency_name is provided', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, '2. MANAGING AGENT', 'Agent section header');
      assertContains(html, 'Premier Realty SA', 'Agency name');
      assertContains(html, '2020/123456/07', 'Agency reg number');
      assertContains(html, 'Sarah Agent', 'Agent name');
      assertContains(html, '+27 11 234 5678', 'Agent phone');
    });

    it('hides agent section when no agent data is provided', () => {
      const html = generateLeaseHTML(minimalFixture);
      assertNotContains(html, '2. MANAGING AGENT', 'No agent section');
    });
  });

  describe('Schedule table — Tenant details', () => {
    it('renders tenant full name', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'Jane Tenant', 'Tenant name');
    });

    it('renders tenant ID, date of birth, email, phone when provided', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, '9001016009088', 'Tenant ID');
      assertContains(html, '1 January 1990', 'Tenant DOB formatted');
      assertContains(html, 'jane@tenant.com', 'Tenant email');
      assertContains(html, '+27 72 987 6543', 'Tenant phone');
    });
  });

  describe('Schedule table — Premises', () => {
    it('renders property title and address with postal code', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'Sunset Villa', 'Property title');
      assertContains(html, '12 Ocean Drive', 'Address line');
      assertContains(html, 'Cape Town', 'City');
      assertContains(html, 'Western Cape', 'Province');
      assertContains(html, '8001', 'Postal code');
    });
  });

  describe('Schedule table — Financial terms', () => {
    it('renders monthly rental amount', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, `R 12\u00a0500,00`, 'Formatted rent');
    });

    it('renders payment due day with ordinal suffix', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, '7th day', '7th ordinal');
    });

    it('renders deposit amount when provided', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'Security Deposit', 'Deposit label');
      assertContains(html, `R 12\u00a0500,00`, 'Deposit amount');
    });

    it('renders annual escalation when type is set', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'Annual Escalation', 'Escalation label');
      assertContains(html, '8% every 12 months', 'Escalation detail');
    });

    it('renders interest on arrears rate when set', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, '15.5% per annum', 'Interest rate');
    });

    it('renders lease type as Fixed Term for fixed leases', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'Fixed Term', 'Lease type');
    });
  });

  describe('Financial clauses', () => {
    it('renders security deposit clause when deposit is provided', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, '2. SECURITY DEPOSIT', 'Deposit clause');
      assertContains(html, 'Rental Housing Act', 'RHA reference');
    });

    it('hides security deposit clause when deposit is null', () => {
      const html = generateLeaseHTML(minimalFixture);
      assertNotContains(html, 'SECURITY DEPOSIT', 'No deposit clause');
    });

    it('renders interest on arrears clause when rate is set', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'INTEREST ON ARREARS', 'Arrears clause');
      assertContains(html, 'prime lending rate', 'Prime rate reference');
    });

    it('hides interest on arrears clause when rate is not set', () => {
      const html = generateLeaseHTML(minimalFixture);
      assertNotContains(html, 'INTEREST ON ARREARS', 'No arrears clause');
    });

    it('renders rent escalation clause when escalation type is set', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'RENT ESCALATION', 'Escalation clause');
    });

    it('renders late payment fee clause when fee is set', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'LATE PAYMENT FEE', 'Late fee clause');
      assertContains(html, 'R 200,00', 'Late fee amount');
    });
  });

  describe('Legal clauses', () => {
    it('renders fixed-term termination wording for fixed leases', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'fixed-term lease shall terminate on the end date', 'Fixed term text');
      assertContains(html, 'Consumer Protection Act (CPA s14)', 'CPA reference');
    });

    it('renders month-to-month termination wording for month_to_month leases', () => {
      const html = generateLeaseHTML(minimalFixture);
      assertContains(html, 'month-to-month lease by providing 30 calendar days', 'MTM termination text');
    });

    it('renders DOMICILIUM clause', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'DOMICILIUM', 'Domicilium clause');
      assertContains(html, 'citandi et executandi', 'Latin legal term');
    });

    it('renders GOVERNING LAW clause with SA acts', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'GOVERNING LAW', 'Governing law clause');
      assertContains(html, 'Rental Housing Act, 1999', 'RHA');
      assertContains(html, 'Consumer Protection Act, 2008', 'CPA');
    });
  });

  describe('Signature section', () => {
    it('renders landlord and tenant signature boxes with names', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'LANDLORD / OWNER', 'Owner signature box');
      assertContains(html, 'John Owner', 'Owner name in signatures');
      assertContains(html, 'TENANT', 'Tenant signature box');
      assertContains(html, 'Jane Tenant', 'Tenant name in signatures');
    });

    it('shows signed dates when provided', () => {
      const html = generateLeaseHTML(fullFixture);
      assertContains(html, 'Signed:', 'Signed label');
      assertContains(html, 'Pending electronic signature', 'Pending fallback');
    });

    it('shows pending signature when dates are null', () => {
      const html = generateLeaseHTML(minimalFixture);
      assertContains(html, 'Pending electronic signature', 'Pending for unsigned');
    });
  });

  describe('Conditional rendering — minimal fixture', () => {
    it('does not show tenant ID, DOB, email, phone when omitted', () => {
      const html = generateLeaseHTML(minimalFixture);
      assertNotContains(html, 'ID / Passport number', 'No tenant ID');
      assertNotContains(html, 'Date of birth', 'No DOB');
      assertNotContains(html, 'Email', 'No email label from tenant');
    });

    it('uses 1st as default payment due day with 1st ordinal', () => {
      const html = generateLeaseHTML(minimalFixture);
      assertContains(html, 'The 1st day', 'Default 1st day');
    });

    it('renders lease type as Month-to-Month for month_to_month leases', () => {
      const html = generateLeaseHTML(minimalFixture);
      assertContains(html, 'Month-to-Month', 'MTM lease type');
    });

    it('does not render escalation row when escalation type is null', () => {
      const html = generateLeaseHTML(minimalFixture);
      assertNotContains(html, 'Annual Escalation', 'No escalation');
    });
  });
});

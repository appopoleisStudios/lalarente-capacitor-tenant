# Client Requirements Analysis - Lala Rente Dashboard Features

**Date:** 2025-08-13  
**Client:** Navin Indraj Tauseef Qatar  
**Status:** Requirements Analysis Complete

---

## 1. Notifications System

### Notification Types & Triggers
```
📱 Payment Notifications
├── Rent Due (3 days before due date)
├── Rent Overdue (1 day after due date)
├── Payment Received (immediate)
└── Payment Failed (immediate)

🏠 Property Notifications
├── New Maintenance Request (immediate)
├── Maintenance Status Update (immediate)
├── Inspection Scheduled (1 day before)
├── Lease Expiring (30 days before)
└── Property Available (immediate)

💰 Financial Notifications
├── Monthly Earnings Report (1st of month)
├── YTD Report Available (quarterly)
├── Commission Payment (monthly)
└── Arrears Alert (weekly if >7 days)

👥 User Notifications
├── Profile Verification Required
├── Document Upload Required
└── Welcome Message (new user)
```

### Database Schema Addition
```sql
-- Add to existing schema
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'payment', 'property', 'financial', 'user'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- Additional context data
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- Optional expiration
);

-- Index for performance
CREATE INDEX idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
```

---

## 2. Property Viewing Icon & Architecture

### Property Card Component Design
```
┌─────────────────────────────────────┐
│ 🏠 Property Title                   │
│ 📍 Address, City, Province          │
│ 💰 R 15,000/month                   │
│ 🛏️ 3 beds • 2 baths • 2 parking    │
│ 📊 Status: Available/Occupied       │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │IMG1 │ │IMG2 │ │IMG3 │ │ +2  │    │
│ └─────┘ └─────┘ └─────┘ └─────┘    │
│ [View Details] [Edit] [Delete]      │
└─────────────────────────────────────┘
```

### Property Detail View Architecture
```
┌─────────────────────────────────────┐
│ ← Back    Property Details    Edit  │
├─────────────────────────────────────┤
│ 🏠 Property Title                   │
│ 📍 Full Address                     │
│ 💰 R 15,000/month                   │
├─────────────────────────────────────┤
│ 📸 Image Gallery (swipeable)        │
├─────────────────────────────────────┤
│ 📋 Details                          │
│ ├─ Type: Apartment                  │
│ ├─ Bedrooms: 3                      │
│ ├─ Bathrooms: 2                     │
│ ├─ Parking: 2 spaces                │
│ ├─ Amenities: Pool, Gym, Security   │
│ └─ Status: Available                │
├─────────────────────────────────────┤
│ 📊 Financial Summary                │
│ ├─ Monthly Rent: R 15,000           │
│ ├─ Deposit: R 30,000                │
│ ├─ Commission: R 750 (5%)           │
│ └─ Net Income: R 14,250             │
├─────────────────────────────────────┤
│ 📅 Current Lease                    │
│ ├─ Tenant: John Doe                 │
│ ├─ Start: 2025-01-01                │
│ ├─ End: 2025-12-31                  │
│ └─ Status: Active                   │
├─────────────────────────────────────┤
│ 🔧 Recent Maintenance               │
│ ├─ Plumbing Issue (2025-08-10)     │
│ └─ Status: In Progress              │
└─────────────────────────────────────┘
```

---

## 3. Monthly Earnings Report Format

### Report Structure
```
📊 MONTHLY EARNINGS REPORT - August 2025
═══════════════════════════════════════════

💰 TOTAL EARNINGS: R 142,500
├─ Gross Rent: R 150,000
├─ Commission: R 7,500 (5%)
└─ Net Earnings: R 142,500

📈 PROPERTY BREAKDOWN
┌─────────────────────────────────────────┐
│ Property    │ Rent    │ Commission │ Net │
├─────────────────────────────────────────┤
│ Apartment A │ R45,000 │ R2,250     │ R42,750 │
│ House B     │ R35,000 │ R1,750     │ R33,250 │
│ Flat C      │ R25,000 │ R1,250     │ R23,750 │
│ Studio D    │ R20,000 │ R1,000     │ R19,000 │
│ Office E    │ R25,000 │ R1,250     │ R22,500 │
└─────────────────────────────────────────┘

📊 OCCUPANCY SUMMARY
├─ Total Properties: 5
├─ Occupied: 4 (80%)
├─ Vacant: 1 (20%)
└─ Average Occupancy: 80%

⚠️ ARREARS SUMMARY
├─ Properties with Arrears: 1
├─ Total Arrears: R 15,000
└─ Days Overdue: 7

📅 PAYMENT STATUS
├─ On Time: 3 properties
├─ Late (1-7 days): 1 property
└─ Overdue (>7 days): 1 property
```

### Database Query for Monthly Report
```sql
-- Monthly earnings calculation
WITH monthly_data AS (
  SELECT 
    p.id,
    p.title,
    p.rent_amount,
    p.deposit_amount,
    l.lease_start,
    l.lease_end,
    l.rent_amount as lease_rent,
    COALESCE(l.rent_amount, p.rent_amount) as actual_rent,
    CASE 
      WHEN l.lease_start <= CURRENT_DATE 
      AND l.lease_end >= CURRENT_DATE 
      THEN true 
      ELSE false 
    END as is_occupied,
    CASE 
      WHEN l.lease_start <= CURRENT_DATE 
      AND l.lease_end >= CURRENT_DATE 
      THEN COALESCE(l.rent_amount, p.rent_amount) * 0.05
      ELSE 0 
    END as commission
  FROM properties p
  LEFT JOIN leases l ON p.id = l.property_id 
    AND l.lease_start <= CURRENT_DATE 
    AND l.lease_end >= CURRENT_DATE
  WHERE p.owner_id = $1
)
SELECT 
  SUM(actual_rent) as gross_rent,
  SUM(commission) as total_commission,
  SUM(actual_rent - commission) as net_earnings,
  COUNT(*) as total_properties,
  COUNT(CASE WHEN is_occupied THEN 1 END) as occupied_properties,
  ROUND(
    (COUNT(CASE WHEN is_occupied THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2
  ) as occupancy_rate
FROM monthly_data;
```

---

## 4. YTD (Year-to-Date) Report Sample

### YTD Report Format
```
📊 YEAR-TO-DATE EARNINGS REPORT - 2025
═══════════════════════════════════════════

💰 TOTAL YTD EARNINGS: R 1,140,000
├─ Gross Rent: R 1,200,000
├─ Commission: R 60,000 (5%)
└─ Net Earnings: R 1,140,000

📈 MONTHLY BREAKDOWN
┌─────────────────────────────────────────┐
│ Month    │ Gross Rent │ Commission │ Net │
├─────────────────────────────────────────┤
│ January  │ R150,000   │ R7,500     │ R142,500 │
│ February │ R150,000   │ R7,500     │ R142,500 │
│ March    │ R150,000   │ R7,500     │ R142,500 │
│ April    │ R150,000   │ R7,500     │ R142,500 │
│ May      │ R150,000   │ R7,500     │ R142,500 │
│ June     │ R150,000   │ R7,500     │ R142,500 │
│ July     │ R150,000   │ R7,500     │ R142,500 │
│ August   │ R150,000   │ R7,500     │ R142,500 │
└─────────────────────────────────────────┘

🏠 PROPERTY PORTFOLIO SUMMARY
┌─────────────────────────────────────────┐
│ Property    │ YTD Rent │ YTD Commission │ YTD Net │
├─────────────────────────────────────────┤
│ Apartment A │ R540,000 │ R27,000        │ R513,000 │
│ House B     │ R420,000 │ R21,000        │ R399,000 │
│ Flat C      │ R300,000 │ R15,000        │ R285,000 │
│ Studio D    │ R240,000 │ R12,000        │ R228,000 │
│ Office E    │ R300,000 │ R15,000        │ R285,000 │
└─────────────────────────────────────────┘

📊 PERFORMANCE METRICS
├─ Average Monthly Earnings: R 142,500
├─ Best Month: January (R 142,500)
├─ Worst Month: August (R 142,500)
├─ Growth Rate: 0% (consistent)
└─ Portfolio Value: R 5,000,000

📈 OCCUPANCY TRENDS
├─ Average YTD Occupancy: 80%
├─ Peak Occupancy: 100% (Jan-Mar)
├─ Lowest Occupancy: 60% (July)
└─ Vacancy Loss: R 60,000
```

### Database Schema for YTD Calculations
```sql
-- Add payment tracking for YTD calculations
ALTER TABLE payments ADD COLUMN IF NOT EXISTS year INTEGER DEFAULT EXTRACT(YEAR FROM created_at);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS month INTEGER DEFAULT EXTRACT(MONTH FROM created_at);

-- Create view for YTD calculations
CREATE VIEW ytd_earnings AS
SELECT 
  EXTRACT(YEAR FROM p.created_at) as year,
  EXTRACT(MONTH FROM p.created_at) as month,
  p.property_id,
  pr.title as property_title,
  SUM(p.amount) as gross_rent,
  SUM(p.commission_amount) as commission,
  SUM(p.net_amount) as net_earnings,
  COUNT(*) as payment_count
FROM payments p
JOIN properties pr ON p.property_id = pr.id
WHERE p.status = 'paid'
GROUP BY year, month, p.property_id, pr.title;

-- YTD query
SELECT 
  SUM(gross_rent) as ytd_gross,
  SUM(commission) as ytd_commission,
  SUM(net_earnings) as ytd_net,
  COUNT(DISTINCT property_id) as active_properties
FROM ytd_earnings 
WHERE year = EXTRACT(YEAR FROM CURRENT_DATE);
```

---

## 5. Average Occupancy Calculation

### Business Logic
```
OCCUPANCY CALCULATION FORMULA:
─────────────────────────────────────────

Total Available Months = Number of Properties × 12 months
Actual Occupied Months = Sum of all lease durations in months

Average Occupancy Rate = (Actual Occupied Months / Total Available Months) × 100

EXAMPLE:
─────────────────────────────────────────
Properties: 5
Total Available Months: 5 × 12 = 60 months

Lease Durations:
├─ Property A: 12 months (Jan-Dec)
├─ Property B: 8 months (Mar-Oct)
├─ Property C: 6 months (May-Oct)
├─ Property D: 0 months (vacant)
└─ Property E: 12 months (Jan-Dec)

Actual Occupied Months: 12 + 8 + 6 + 0 + 12 = 38 months
Average Occupancy: (38 / 60) × 100 = 63.33%
```

### Database Implementation
```sql
-- Function to calculate occupancy rate
CREATE OR REPLACE FUNCTION calculate_occupancy_rate(
  owner_id_param UUID,
  start_date DATE DEFAULT DATE_TRUNC('year', CURRENT_DATE),
  end_date DATE DEFAULT CURRENT_DATE
) RETURNS DECIMAL AS $$
DECLARE
  total_properties INTEGER;
  total_available_months INTEGER;
  actual_occupied_months INTEGER;
  occupancy_rate DECIMAL;
BEGIN
  -- Get total properties
  SELECT COUNT(*) INTO total_properties
  FROM properties 
  WHERE owner_id = owner_id_param;
  
  -- Calculate total available months
  total_available_months := total_properties * 12;
  
  -- Calculate actual occupied months
  SELECT COALESCE(SUM(
    CASE 
      WHEN l.lease_start < start_date THEN 
        GREATEST(0, DATE_PART('month', AGE(end_date, start_date)))
      WHEN l.lease_end > end_date THEN 
        GREATEST(0, DATE_PART('month', AGE(end_date, l.lease_start)))
      ELSE 
        GREATEST(0, DATE_PART('month', AGE(l.lease_end, l.lease_start)))
    END
  ), 0) INTO actual_occupied_months
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE p.owner_id = owner_id_param
    AND l.lease_start <= end_date
    AND l.lease_end >= start_date;
  
  -- Calculate occupancy rate
  IF total_available_months > 0 THEN
    occupancy_rate := (actual_occupied_months::DECIMAL / total_available_months) * 100;
  ELSE
    occupancy_rate := 0;
  END IF;
  
  RETURN ROUND(occupancy_rate, 2);
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Rental Payment Arrears Calculation

### Arrears Business Logic
```
ARREARS CALCULATION RULES:
─────────────────────────────────────────

1. DUE DATE: Based on lease agreement (e.g., 1st of month)
2. GRACE PERIOD: 7 days (configurable per property)
3. ARREARS START: Day 8 after due date
4. ARREARS AMOUNT: Full rent amount + late fees

LATE FEE STRUCTURE:
├─ 1-7 days: No late fee (grace period)
├─ 8-14 days: R 500 late fee
├─ 15-30 days: R 1,000 late fee
└─ 31+ days: R 2,000 late fee

EXAMPLE CALCULATION:
─────────────────────────────────────────
Rent Due: R 15,000 (due 1st August)
Payment Date: 10th August
Days Late: 9 days
Late Fee: R 500
Total Arrears: R 15,500
```

### Database Schema for Arrears Tracking
```sql
-- Add arrears tracking to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS days_late INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS late_fee DECIMAL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 7;

-- Function to calculate arrears
CREATE OR REPLACE FUNCTION calculate_arrears(
  payment_id_param UUID
) RETURNS TABLE(
  days_late INTEGER,
  late_fee DECIMAL,
  total_arrears DECIMAL
) AS $$
DECLARE
  payment_record RECORD;
  days_late_val INTEGER;
  late_fee_val DECIMAL;
BEGIN
  -- Get payment details
  SELECT * INTO payment_record
  FROM payments
  WHERE id = payment_id_param;
  
  -- Calculate days late
  days_late_val := CURRENT_DATE - payment_record.due_date;
  
  -- Calculate late fee based on days late
  late_fee_val := CASE
    WHEN days_late_val <= payment_record.grace_period_days THEN 0
    WHEN days_late_val <= 14 THEN 500
    WHEN days_late_val <= 30 THEN 1000
    ELSE 2000
  END;
  
  -- Return results
  RETURN QUERY SELECT 
    days_late_val,
    late_fee_val,
    payment_record.amount + late_fee_val;
END;
$$ LANGUAGE plpgsql;

-- View for current arrears
CREATE VIEW current_arrears AS
SELECT 
  p.id as payment_id,
  p.tenant_id,
  pr.full_name as tenant_name,
  prop.title as property_title,
  p.amount as rent_amount,
  p.due_date,
  CURRENT_DATE - p.due_date as days_late,
  CASE
    WHEN (CURRENT_DATE - p.due_date) <= p.grace_period_days THEN 0
    WHEN (CURRENT_DATE - p.due_date) <= 14 THEN 500
    WHEN (CURRENT_DATE - p.due_date) <= 30 THEN 1000
    ELSE 2000
  END as late_fee,
  p.amount + CASE
    WHEN (CURRENT_DATE - p.due_date) <= p.grace_period_days THEN 0
    WHEN (CURRENT_DATE - p.due_date) <= 14 THEN 500
    WHEN (CURRENT_DATE - p.due_date) <= 30 THEN 1000
    ELSE 2000
  END as total_arrears
FROM payments p
JOIN profiles pr ON p.tenant_id = pr.id
JOIN properties prop ON p.property_id = prop.id
WHERE p.status = 'pending'
  AND p.due_date < CURRENT_DATE
  AND (CURRENT_DATE - p.due_date) > p.grace_period_days;
```

---

## Implementation Priority

### Phase 1: Core Features (Week 1-2)
1. **Notifications System**
   - Database schema
   - Basic notification components
   - Email/SMS integration

2. **Property Viewing**
   - Property card components
   - Detail view pages
   - Image gallery

### Phase 2: Financial Reports (Week 3-4)
3. **Monthly Earnings Report**
   - Report generation logic
   - PDF export functionality
   - Dashboard integration

4. **YTD Reports**
   - Historical data aggregation
   - Performance metrics
   - Portfolio analysis

### Phase 3: Business Logic (Week 5-6)
5. **Occupancy Calculations**
   - Database functions
   - Real-time calculations
   - Trend analysis

6. **Arrears Tracking**
   - Payment monitoring
   - Late fee calculations
   - Automated alerts

---

## Next Steps

1. **Database Migration**: Implement new tables and functions
2. **UI Components**: Create notification and property viewing components
3. **Business Logic**: Implement calculations for reports and arrears
4. **Testing**: Validate all calculations and edge cases
5. **Client Review**: Present mockups and get feedback before full implementation

**Estimated Timeline**: 6 weeks for complete implementation
**Resource Requirements**: Full-stack developer, UI/UX designer, database specialist

---

## 7. Maintenance Management System (MMS)

Based on the client’s MMS flow (diagram: Raising a Notification → Acknowledging the notification → Push to Dedicated Vendors → Issue Purchase Order → Execute Work → Close Work), we are adding an explicit maintenance workflow that complements our existing `maintenance_requests` and vendor service contracts.

### 7.1 Process Flow (DB-first)

1) Raising a Notification
- Triggered by tenant/owner (or IoT/sensor later) to create a maintenance signal.
- Creates a `maintenance_requests` row and a `notifications` row for the owner/PM.

2) Acknowledging the Notification
- Owner/PM acknowledges the request; writes audit and sets request status to `acknowledged`.

3) Push to Dedicated Vendors
- Route the request to a configured set of preferred vendors by category and service area.
- Vendors get in‑app/email. Vendors can respond with a quote or accept a pre‑defined rate.

4) Issue Purchase Order (PO)
- After owner selects a vendor/quote, the system issues a PO capturing line items, taxes (if VAT‑registered), and platform fee.
- PO PDF is generated and attached; status becomes `po_issued`.

5) Execute Work
- Vendor starts/stops execution window; attaches proof (photos/docs), logs time/materials if applicable; status `in_progress`.

6) Close Work
- Vendor submits closure report. Owner (and optionally tenant) approves/acknowledges; status `closed`.
- Invoice/receipt generated from PO; payouts processed.

### 7.2 Minimal Schema Additions

```sql
-- Dedicated vendor routing
create table if not exists public.dedicated_vendors (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  category_id uuid null references public.service_categories(id) on delete set null,
  vendor_id uuid not null references public.profiles(id) on delete cascade,
  priority smallint default 1,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Purchase Orders (header)
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.service_contracts(id) on delete cascade,
  po_number text not null unique,
  currency text default 'ZAR',
  subtotal numeric,
  vat_amount numeric,
  platform_fee_amount numeric,
  total_amount numeric,
  status text not null default 'po_issued', -- po_issued|in_progress|closed|void
  pdf_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  description text not null,
  qty numeric not null default 1,
  unit_price numeric not null,
  unit text null,
  tax_rate numeric null
);

-- Execution & closure
create table if not exists public.job_executions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.service_contracts(id) on delete cascade,
  status text not null default 'not_started', -- not_started|in_progress|paused|completed
  start_at timestamptz null,
  end_at timestamptz null,
  sla_window_start timestamptz null,
  sla_window_end timestamptz null,
  notes text null,
  created_at timestamptz default now()
);

create table if not exists public.job_attachments (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.job_executions(id) on delete cascade,
  url text not null,
  kind text not null -- photo|pdf|other
);

create table if not exists public.closure_reports (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.service_contracts(id) on delete cascade,
  vendor_notes text null,
  owner_accept_at timestamptz null,
  tenant_ack_at timestamptz null,
  closed_at timestamptz null
);
```

Security/RLS: All new tables follow party‑based visibility (owner, vendor, and tenant if present). Writes are restricted to the acting party. Audit events logged via SECURITY DEFINER RPCs.

### 7.3 UI Impacts

- Owner:
  - Acknowledge notification; push to dedicated vendors; review quotes; issue PO (number + lines + totals).  
  - Approve closure report; convert to invoice; review payouts.

- Vendor (Home/Jobs):
  - See PO section on the contract page; Start/End execution; add attachments; submit closure; see status pills (PO Issued/In Progress/Awaiting Closure/Closed).

- Tenant (optional):
  - View read‑only contract; acknowledge closure where required; rate the service.

### 7.4 Alignment With Existing Build

- Our `service_contracts` remain the agreement backbone. We insert PO and Execution/Closure between signatures and completion.
- Existing audit, signatures, and document integrity (PDF/hash) continue unchanged.

### 7.5 Dedicated Vendors – Business Semantics & Routing Defaults

- Definition: Dedicated Vendors are long‑term/retainer vendors preferred by an owner for a particular `property_id` (optionally scoped by `category_id`). They are often backed by an active service contract but can be curated manually pre‑contract.
- Contract linkage: Activating a service contract should create or reactivate the matching `dedicated_vendors` row (`is_active=true`, `priority` from contract if applicable). Ending/terminating the contract should set `is_active=false`.
- Routing defaults: When an owner selects “Invite Vendors” without specifying individuals, the system auto‑invites all active dedicated vendors for that property/category via `route_maintenance_request_to_vendors`. If none exist, the request defaults to open market (`visibility='public'`).
- RLS: Owners manage rows for properties they own; vendors can read rows where `vendor_id = auth.uid()`. See `016_mms_flow_integration.sql` for indices and policies.

### 7.6 Financial Rules (VAT and Platform Fee)

- VAT line appears only if the vendor is VAT‑registered (store `vendor.vat_registered` and optional `vat_number`). Many vendors will not charge VAT.
- Platform fee applies to all vendor payouts (e.g., 10–20%). UI shows customer total, VAT (if applicable), discount, platform fee, and vendor payout calculation.

### 7.5 Roadmap Adjustments

- Phase 1.2: Notifications/Acknowledgment + Dedicated Vendors; basic PO header (single total); minimal Execute/Close (start/end + single attachment); status pills and audit.
- Phase 1.3: Full PO (lines, VAT/platform fee math), Execution with time/materials + attachments, Closure approvals, invoice generation, payouts integration.


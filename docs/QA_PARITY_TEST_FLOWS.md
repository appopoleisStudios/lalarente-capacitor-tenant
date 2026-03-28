# Lalarente — Owner / Tenant Parity QA Test Flows

**Version:** 1.0.3 | **Date:** 2026-03-27
**Purpose:** Manual QA testing guide for end-to-end owner-tenant parity flows
**Test accounts needed:** 1 Owner account + 1 Tenant account on the same Supabase instance

---

## How to Use This Document

- Run each flow with **both** the owner and tenant devices/sessions open side by side
- Each flow has an **Owner side** and a **Tenant side** — check both after every action
- Mark each step: ✅ Pass | ❌ Fail | ⚠️ Partial
- Note the exact screen name and error message for any failure

---

## TEST ACCOUNTS SETUP

Before running any flows, set up fresh test accounts:

| Role | Email | Notes |
|------|-------|-------|
| Owner | owner@test.lalarente.co.za | Must have at least 1 property added |
| Tenant | tenant@test.lalarente.co.za | Fresh account, no active lease |

---

## FLOW 1 — Authentication & Session

### 1.1 Registration

| Step | Action | Owner Expected | Tenant Expected |
|------|--------|---------------|-----------------|
| 1 | Open app fresh (never logged in) | Login screen shown | Login screen shown |
| 2 | Tap "Create Account" | Register screen opens | Register screen opens |
| 3 | Select role | "Owner" button highlights | "Tenant" button highlights |
| 4 | Fill name, email, password, confirm password | Fields accept input; no emoji icons | Fields accept input |
| 5 | Tap "Create Account" | Navigates to Owner Dashboard | Navigates to Tenant Dashboard |
| 6 | Check name shown on dashboard | Correct full name shown | Correct full name shown |

### 1.2 Login / Logout

| Step | Action | Owner Expected | Tenant Expected |
|------|--------|---------------|-----------------|
| 1 | Log out from Profile screen | Returns to Login screen | Returns to Login screen |
| 2 | Log back in with correct credentials | Reaches correct dashboard | Reaches correct dashboard |
| 3 | Enter wrong password | Shows error message | Shows error message |
| 4 | Log in successfully | Dashboard loads with real data | Dashboard loads with real data |

### 1.3 Session Persistence ⭐ Critical

| Step | Action | Owner Expected | Tenant Expected |
|------|--------|---------------|-----------------|
| 1 | Log in | On dashboard | On dashboard |
| 2 | Swipe app away (full close) | — | — |
| 3 | Reopen app | Goes straight to dashboard — NO login required | Goes straight to dashboard — NO login required |
| 4 | Background app for 10 min then return | Still on dashboard | Still on dashboard |

---

## FLOW 2 — Profile Management

### 2.1 Owner Profile

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open Profile tab | Real name and email shown (not "Thabo Mokoena") |
| 2 | Tap "Edit" | Name and phone fields become editable |
| 3 | Change name | Name updates in input |
| 4 | Tap "Save" | "Profile updated successfully" alert shown |
| 5 | Navigate away, come back to Profile | New name persists |
| 6 | Tap "Notifications" | Notifications screen opens |
| 7 | Tap "Privacy & POPIA" | Privacy screen opens |
| 8 | Tap "Arrears Management" | Arrears screen opens |
| 9 | Tap "Lease Renewals" | Renewals screen opens |

### 2.2 Tenant Profile

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open Profile | Correct email (matches login email) shown |
| 2 | Tap "Edit" | All fields become editable |
| 3 | Tap "Date of Birth" field | Native date picker (calendar) opens |
| 4 | Select a date | Date fills in YYYY-MM-DD format |
| 5 | Tap Phone country code chip (+27) | Alert shows country code options |
| 6 | Select "+263 Zimbabwe" | Chip updates to +263 |
| 7 | Enter local phone number | Accepted in phone field |
| 8 | Fill in ID Number, Employer, Income | Fields accept input |
| 9 | Tap "Save" | "Profile updated successfully" shown |
| 10 | Navigate away, come back | All values persist correctly |
| 11 | Tap "Upload utility bill or bank statement" (WITHOUT tapping Edit first) | File picker opens (upload always available) |
| 12 | Select an image | Upload succeeds, "Document uploaded" shown |

### 2.3 Tenant Verification Status on Dashboard

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open Tenant Dashboard before filling profile | "Complete Your Profile" card shows all 3 items incomplete |
| 2 | Fill in ID Number in Profile and Save | Return to dashboard — "Identity Verification" row shows checkmark |
| 3 | Fill in Monthly Income and Save | "Proof of Income" row shows checkmark |
| 4 | Upload proof of address | "References" row shows checkmark |
| 5 | All 3 complete | "Complete Your Profile" card disappears from dashboard |

---

## FLOW 3 — Property Management (Owner) + Property Search (Tenant)

### 3.1 Owner Adds a Property

| Step | Action | Expected |
|------|--------|----------|
| 1 | Owner: Tap "Add Property" or "+" | Add Property screen opens |
| 2 | Fill in Title, Address, City, Province | Fields accept input |
| 3 | Set Rent Amount | Numeric input accepted |
| 4 | Set bedrooms, bathrooms, parking | Numbers accepted |
| 5 | Toggle "Pets Allowed" | Switch toggles |
| 6 | Set "Available From" date | Date input accepted |
| 7 | Select property photos (optional) | Photos appear in preview row |
| 8 | Tap "Create Property" | Success alert shown, navigates back |
| 9 | Property appears in Properties list | Title, rent, status "Available" shown |

### 3.2 Tenant Searches for Properties

| Step | Action | Expected |
|------|--------|----------|
| 1 | Tenant: Open Search / Browse | Property list loads |
| 2 | The property added above is visible | Title, address, rent shown |
| 3 | Tap the property | Property detail screen opens |
| 4 | View photos, specs, amenities | All correct info displayed |
| 5 | "Request Viewing" button visible | Button present and tappable |

### 3.3 Owner Edits a Property

| Step | Action | Expected |
|------|--------|----------|
| 1 | Owner: Open property → Tap Edit | Edit Property screen opens with pre-filled data |
| 2 | Change rent amount | New value accepted |
| 3 | Tap Save | Changes saved, updated amount shown |
| 4 | Tenant views same property | Updated rent shown |

---

## FLOW 4 — Viewing Requests ⭐ Core Flow

### 4.1 Tenant Requests a Viewing

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Tenant taps "Request Viewing" on a property | — | Date/time picker shown |
| 2 | Tenant selects date and time and submits | 🔔 Bell badge increments | "Viewing requested" confirmation |
| 3 | Owner Dashboard | Yellow alert card: "X Viewing Request(s) Awaiting Response" | Viewing appears in "Upcoming Viewings" section |
| 4 | Owner: Viewing Requests section | New pending viewing card shown | — |
| 5 | Owner: Recent Activity | "Viewing Request · Tenant @ Property" item appears | — |

### 4.2 Owner Approves a Viewing

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Owner taps viewing request | Viewing detail screen | — |
| 2 | Owner taps "Approve" | Status changes to "Approved" | Dashboard auto-updates: viewing moves to "Upcoming Viewings" with confirmed date |
| 3 | Owner Dashboard | Yellow alert card gone | — |
| 4 | Owner Recent Activity | "Viewing Confirmed" activity item | — |
| 5 | Tenant Viewings screen | Status shows "Approved" with confirmed date/time | — |

### 4.3 Owner Declines with Alternative Times

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Owner taps viewing request | Viewing detail | — |
| 2 | Owner taps "Decline" and enters 2 alternative times | Status "Declined", alt times saved | — |
| 3 | Owner Dashboard | Blue "Alternatives Offered" card appears | Yellow alert card: "1 viewing response from owner" |
| 4 | Owner: Viewing Requests section | Declined viewing card shows "Alt. times offered" sub-label | — |
| 5 | Owner Recent Activity | "Alt. Times Offered" activity item | — |
| 6 | Tenant: Viewing detail screen | "Owner suggested alternatives" section with times shown | — |

### 4.4 Tenant Cancels a Viewing

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Tenant opens an approved viewing | — | Viewing detail with "Cancel" option |
| 2 | Tenant cancels | Viewing disappears from pending list | Status shows "Cancelled" |
| 3 | Owner: Viewings screen (All tab) | Shows as "Cancelled" in history | — |

---

## FLOW 5 — Rental Applications ⭐ Core Flow

### 5.1 Tenant Applies for a Property

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Tenant taps "Apply for this Property" | — | Application form opens |
| 2 | Tenant fills in required fields | — | Form accepts input |
| 3 | Tenant submits application | 🔔 Bell badge increments; new applicant in Applicants section | Redirected to Application Status screen (not dashboard) |
| 4 | Owner Dashboard | New application card in Applicants section | Application shows status "Submitted" |
| 5 | Owner: Open application detail | Full application with tenant info, income, ID | — |

### 5.2 Owner Reviews Application

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Owner opens application | Full details screen | — |
| 2 | Owner taps "Approve" | Status → "Approved" | Application Status shows "Approved" |
| 3 | Owner taps "Request Holding Deposit" | Holding deposit created | Tenant: holding deposit banner appears on application |
| 4 | Owner taps "Reject" (on a different application) | Status → "Rejected" | Application Status shows "Rejected" |

### 5.3 Multiple Applications — Competition

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | 2+ tenants apply for same property | "Compare" podium button appears on property's application group | — |
| 2 | Owner taps "Compare" | Application Competition screen with ranked scores | — |
| 3 | Owner selects winner | Winner marked, others notified | — |

---

## FLOW 6 — Holding Deposits

### 6.1 Holding Deposit Lifecycle

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Owner requests holding deposit | Holding Deposit screen shows "Pending" | Holding Deposit screen shows amount due + countdown |
| 2 | Tenant taps "I Have Paid" | Status → "Paid" | Status → "Paid" |
| 3 | Owner: Holding Deposit screen | Active count updates on dashboard tile | — |
| 4 | Owner applies deposit to lease | Status → "Applied to Lease" | Reflected on tenant side |
| 5 | Owner refunds deposit (if application rejected) | Status → "Refunded" | Tenant sees refund status |

---

## FLOW 7 — Lease Creation & Signing ⭐ Core Flow

### 7.1 Owner Creates Lease

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Owner: Go to Tenant → Create Lease | Lease creation form opens | — |
| 2 | Fill in start date, end date, monthly rent | Fields accept input | — |
| 3 | Tap "Create Lease" | Lease created, status "Pending Owner Signature" | Lease appears on Tenant Lease screen with "Awaiting Owner Signature" |
| 4 | Owner signs the lease | Status → "Pending Tenant Signature" | Tenant: notification / status updates |
| 5 | Tenant opens Lease screen | — | "Sign Lease" button visible |
| 6 | Tenant signs | Lease status → "Active" | Lease shows as "Active" with all details |
| 7 | Owner: Property status | Property status changes to "Rented" | — |
| 8 | Both: Download/View lease PDF | PDF generates and opens | PDF generates and opens |

---

## FLOW 8 — Payments ⭐ Core Flow

### 8.1 Rent Payment

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Active lease in place | Rent Roll shows upcoming payment | Payment screen shows "Next Payment Due" |
| 2 | Tenant taps "Pay Rent" | — | Payment options shown (EFT / PayFast / Yoco) |
| 3 | Tenant selects EFT and marks as paid | 🔔 Bell badge; "Payment Awaiting Confirmation" notification | Status → "Processing" |
| 4 | Owner: Notifications | "Payment Awaiting Confirmation" item | — |
| 5 | Owner confirms payment | Status → "Completed" | Receipt / completed status shown |
| 6 | Owner: Dashboard | Month Income analytics card updates | — |
| 7 | Owner: Recent Activity | "Rent Received R X" item appears | — |

### 8.2 Payment Dispute

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Tenant taps "Dispute a Payment" | — | Dispute form opens |
| 2 | Tenant selects a payment and enters reason | — | Dispute submitted |
| 3 | Owner: Payment Disputes screen | New dispute listed | — |
| 4 | Owner marks "Under Review" | Status → "Under Review" | Status updates on tenant side |
| 5 | Owner accepts or rejects dispute | Final status shown | Resolution shown on tenant side |

### 8.3 Arrears

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Overdue payment exists | "Tenants In Arrears" analytics card > 0; "Arrears Notice" in Activity Feed | Red "Arrears & Escalations" button on Payment screen |
| 2 | Tenant taps Arrears button | — | Arrears screen: escalation stage, cure period countdown, CPA legal banner |
| 3 | Tenant taps "Propose Payment Arrangement" | Owner: Arrears Management shows proposed plan | Confirmation shown |
| 4 | Owner reviews and accepts plan | Plan shown as accepted | Plan confirmed on tenant side |

---

## FLOW 9 — Maintenance ⭐ Core Flow

### 9.1 Tenant Reports Maintenance

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Tenant taps "Report Issue" | — | Report Maintenance form opens |
| 2 | Tenant selects category, describes issue | — | Form accepts input |
| 3 | Tenant attaches photo | — | Photo preview shown |
| 4 | Tenant submits | 🔔 Bell badge; maintenance item in dashboard | Maintenance request in "My Requests" list |
| 5 | Owner Dashboard | Open Maintenance count increments | — |
| 6 | Owner: Recent Activity | "New Maintenance · Property" item appears | — |

### 9.2 Owner Assigns Vendor

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Owner opens maintenance request | Full detail with photos | — |
| 2 | Owner assigns to a vendor | Status → "Assigned" | Status updates on tenant list |
| 3 | Vendor submits quote | Owner: "Quote Received" status; quote amount shown | — |
| 4 | Owner approves quote | Status → "In Progress" | Status → "In Progress" |
| 5 | Owner sends Purchase Order | PO sent to vendor | — |

### 9.3 Maintenance Closure & Verification

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Vendor marks work complete | Owner: "Work Complete" status | Tenant: notification to verify |
| 2 | Owner marks work done | Status → "Pending Closure Verification" | Tenant: "Verify Completion" prompt on Reports screen |
| 3 | Tenant opens Reports screen | — | Pending verifications listed |
| 4 | Tenant taps request → verification screen | — | Completion notes and photos visible |
| 5 | Tenant confirms work done | Status → "Closed" | Status "Closed" |
| 6 | Tenant rejects (work not done) | Owner notified, status reverted | Rejection reason sent |

---

## FLOW 10 — Inspections

### 10.1 Owner Schedules Inspection

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Owner: Schedule Inspection | Form with type (Move-In/Out/Routine), date | — |
| 2 | Select type and date, submit | Inspection in owner's list | Inspection appears in tenant's dashboard/reports |
| 3 | Both open inspection detail | — | — |
| 4 | Owner adds condition notes and photos | Saved to inspection | — |
| 5 | Owner signs inspection report | Owner signature recorded | Tenant: "Awaiting your signature" |
| 6 | Tenant signs | Both signatures recorded; status "Completed" | Inspection closed |
| 7 | Download PDF report | PDF with both signatures generated | PDF with both signatures generated |

---

## FLOW 11 — Lease Renewal

### 11.1 Renewal Negotiation

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Lease expires within 80 days | CPA 80-day notice sent; lease in Renewals dashboard | CPA notice in Lease Renewal screen |
| 2 | Owner sends renewal offer (new rent amount) | Offer sent, status "Offer Sent" | "Lease Renewal Offer" with Accept/Counter/Reject buttons |
| 3 | Tenant accepts offer | Status → "Accepted"; "Execute Renewal" button appears | Acceptance confirmed |
| 4 | Owner taps "Execute Renewal" | New lease created, status "Active" | New lease terms shown |
| 5 | Tenant counters offer (alternative rent) | Counter-offer shown with Accept/Reject | Counter submitted |
| 6 | Owner rejects counter | Status → "Rejected" | Rejection shown |
| 7 | No agreement reached by deadline | Status → "Expired" / escalated | Both notified |

---

## FLOW 12 — Early Termination

### 12.1 Tenant Requests Early Termination

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Tenant opens Early Termination screen | — | Penalty calculation and terms shown |
| 2 | Tenant submits termination request with reason | 🔔 Bell badge; pending termination count on dashboard | Request submitted status |
| 3 | Owner: Early Termination screen | Request with penalty amount shown | — |
| 4 | Owner accepts termination | Lease status → termination accepted | Termination accepted; deposit refund auto-triggered |
| 5 | Deposit Refund auto-triggered | Owner: Deposit Management shows refund initiated | Tenant: Deposit screen shows refund pending |
| 6 | Owner rejects with reason | Rejection shown | Reason displayed |

---

## FLOW 13 — Deposit Management

### 13.1 Deposit Lifecycle

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Active lease with deposit | Deposit Management: deposit amount, accrued interest | Deposit Status: balance, interest earned, RHA rights |
| 2 | Owner views deposit history | Interest accrual entries shown | Same interest history shown |
| 3 | Lease ends — Owner initiates refund | Refund form opens | Refund pending notification |
| 4 | Owner adds a deduction with reason | Deduction listed (e.g., cleaning R500) | Deduction visible with reason |
| 5 | Owner finalises refund | Refund amount = deposit + interest − deductions | Final refund amount shown |
| 6 | Tenant disputes a deduction | — | Option to dispute shown |

---

## FLOW 14 — Documents

### 14.1 Document Hub (Owner)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Owner: Open Documents Hub | All 12 tiles shown with Ionicons (no emojis) |
| 2 | Tap "Lease Contracts" | Navigates to tenants/leases list |
| 3 | Tap "Invoices" | Invoice list (rent + vendor) opens |
| 4 | Tap "Tax Reports" | Tax report screen opens |
| 5 | Tap "Compliance" | Compliance/FICA screen opens |
| 6 | Tap "Statements" | Monthly Statements screen opens |

### 14.2 Tenant Documents

| Step | Action | Expected |
|------|--------|----------|
| 1 | Tenant: Open Documents | Documents screen with upload sections |
| 2 | Upload ID document | File picker opens; upload succeeds |
| 3 | Upload proof of income | Upload succeeds |
| 4 | Uploaded docs listed with status | Document listed with verification status |

---

## FLOW 15 — Notifications

### 15.1 Owner Notifications

| Step | Action | Expected |
|------|--------|----------|
| 1 | Bell icon in dashboard header | Shows badge count for pending items |
| 2 | Tap bell | Navigates to Notifications screen |
| 3 | Notifications screen loads | Viewing requests, maintenance, applications, payments listed |
| 4 | Tap a notification | Navigates to the relevant screen |
| 5 | Pull to refresh | List refreshes |
| 6 | After viewing, return to dashboard | Bell badge clears / decrements |

### 15.2 Tenant Notifications

| Step | Action | Expected |
|------|--------|----------|
| 1 | Tenant: Open Notifications | Screen loads with relevant items |
| 2 | Viewing declined / approved | Item appears with link to viewing detail |
| 3 | Lease signing request | Item appears with link to lease |
| 4 | Payment confirmed | Item appears with payment details |

---

## FLOW 16 — Messaging

### 16.1 Owner-Tenant Messaging

| Step | Action | Owner Sees | Tenant Sees |
|------|--------|-----------|-------------|
| 1 | Tenant: tap compose (pencil icon) in Messages header | — | New message form opens |
| 2 | Tenant: select owner, subject, category (maintenance/lease/general), enter message | — | Form accepts input |
| 3 | Tenant sends message | New thread appears in owner's Messages | Sent; thread opens |
| 4 | Owner opens thread | Message shown with tenant name | — |
| 5 | Owner replies | Reply sent | Tenant receives reply in thread |
| 6 | Unread count | Badge shown on owner messages | Badge shown on tenant messages |

---

## FLOW 17 — Insurance Claims (Owner Only)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Owner: Open Insurance | Claims dashboard with stats |
| 2 | Tap "New Claim" | Create claim form opens |
| 3 | Fill in incident details, amount, date | Form accepts input |
| 4 | Submit claim | Claim created as "Draft" |
| 5 | Open claim → add document | Image picker opens; document uploads |
| 6 | Submit claim | Status → "Submitted" |
| 7 | Track claim progress | Progress tracker shows stages |

---

## FLOW 18 — POPIA / Privacy

### 18.1 Both Roles

| Step | Action | Expected |
|------|--------|----------|
| 1 | Owner: Profile → Privacy & POPIA | Privacy screen opens with POPIA rights |
| 2 | Tenant: Profile → Privacy & Data Rights | Privacy screen opens |
| 3 | Submit Data Access Request (DSAR) | Request submitted confirmation |
| 4 | View consent settings | Consent toggles shown |
| 5 | Request data deletion | Deletion request submitted |

---

## FLOW 19 — Owner Dashboard Analytics

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open Owner Dashboard | 4 analytics cards show: Monthly Income, Occupancy %, Tenants in Arrears, Open Maintenance |
| 2 | All cards use Ionicons (no emojis) | Coloured icon boxes with proper Ionicons |
| 3 | Tap "Monthly Income" card | Navigates to Rent Roll |
| 4 | Tap "Occupancy" card | Navigates to Properties list |
| 5 | Tap "In Arrears" card | Navigates to Arrears screen |
| 6 | Tap "Open Maintenance" card | Navigates to Maintenance list |
| 7 | Documents section tiles | 12 tiles with Ionicons, correct navigation |
| 8 | Pull to refresh | All data reloads |

---

## FLOW 20 — Tenant Dashboard Quick Actions

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open Tenant Dashboard | All sections load: lease, payment, maintenance, viewings |
| 2 | Active lease section shows property name + rent | Correct data shown |
| 3 | "Pay Rent" button | Navigates to Payment screen |
| 4 | "Report Issue" button | Navigates to Maintenance report screen |
| 5 | "Messages" card | Navigates to Messages with unread count |
| 6 | "My Documents" card | Navigates to Tenant Documents screen |
| 7 | "Reports" card | Navigates to Reports screen |
| 8 | Pull to refresh | All data refreshes without login prompt |

---

## REGRESSION CHECKLIST

Run after every build to catch regressions:

- [ ] App does not ask for login after swipe-close (GEN-001 fix)
- [ ] Owner Profile shows real name, not "Thabo Mokoena" (OWN-002 fix)
- [ ] Owner Profile Edit saves correctly (OWN-003 fix)
- [ ] Owner Notifications button navigates correctly (OWN-004 fix)
- [ ] Tenant Profile save does not show "Failed to update" (TEN-004 fix)
- [ ] Tenant email field shows correct auth email (TEN-001 fix)
- [ ] Date of Birth shows date picker, not text field (TEN-002 fix)
- [ ] Phone field shows country code picker chip (TEN-003 fix)
- [ ] Proof of address upload works without tapping Edit first (TEN-005 fix)
- [ ] After filling profile, verification card disappears from dashboard (TEN-007 fix)
- [ ] No emoji icons in Login screen (GEN-003)
- [ ] No emoji icons in Register screen (GEN-003)
- [ ] Analytics grid cards use Ionicons (GEN-003)
- [ ] Documents section tiles use Ionicons (GEN-003)
- [ ] Property detail screen has no emoji in section headings (GEN-003)
- [ ] Declined viewing appears on both owner and tenant side (viewing fix)
- [ ] Recent Activity shows only last 30 days (activity feed fix)
- [ ] Owner can add a new property end-to-end (OWN-001 fix)

---

## BUG REPORT TEMPLATE

When a step fails, record using this format:

```
Flow:        [e.g., Flow 4.2 — Owner Approves Viewing]
Step:        [e.g., Step 3]
Role:        [Owner / Tenant]
Device:      [Android emulator / physical device]
Screen:      [e.g., OwnerDashboardScreen]
Action:      [What was tapped/entered]
Expected:    [What should happen]
Actual:      [What actually happened]
Error shown: [Exact error message if any]
Screenshot:  [Attach]
```

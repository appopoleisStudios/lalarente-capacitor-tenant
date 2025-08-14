# Lala Rente – Project Roadmap (Phased)

Reference: Vendor marketplace modeled after Urban Company [link](https://www.urbancompany.com/)

Note: DB-first approach; public signup allowed with verification and duplicate checks. All features must respect Supabase RLS, policies, and typed SDK usage.

---

## Phase 0 – Foundations (Week 0)
- **0.1 Env & Tooling**: Secrets management, environments, build/deploy checklist.
- **0.2 Supabase Hardening**: RLS policies for `inspections`, `leases`, `maintenance_requests`, `messages`, `property_assignments`; fix multiple-permissive/INITPLAN issues; enable leaked password protection.
- **0.3 Performance**: Add FK indexes flagged by advisors.
- **0.4 Notifications Base**: `notifications` table + indexes; storage buckets scaffold (`contracts`, `receipts`).
- **0.5 Audit**: Contract audit log table patterns; immutable logging strategy.
- **Acceptance**: Green advisors (no WARN for RLS/INITPLAN), indices added, migrations ran.

## Phase 1 – Auth, Roles, Profiles (Week 1)
- **1.1 Auth Model**: Public signup enabled; enforce email/ID duplicate checks, password policy, and role-safe profile creation.
- **1.2 Profile Onboarding**: Minimal PII, avatar, phone. Vendors can self-register but require verification/KYC before activation.
- **1.3 Vendor Profile (UrbanCompany-like)**: Service categories, skills, pricing model, documents/KYC, service areas, availability slots.
- **Schema Adds**: `service_categories`, `vendor_services`, `vendor_service_areas`, `vendor_availability_slots`, `vendor_documents`.
- **Acceptance**: New users can sign up and reach their role dashboard; vendor accounts remain limited until KYC approved.

## Phase 2 – Properties & Assignment (Week 2)
- **2.1 Property CRUD**: Owner creates/edits properties with media gallery.
- **2.2 Vendor Assignment**: Use `property_assignments` for owner↔vendor relationship; contract details JSON.
- **2.3 Property Views**: Card + detail views per spec; mobile-friendly.
- **Acceptance**: Owner sees portfolio; assigned vendors visible and filterable.

## Phase 3 – E‑Signature Contracts & Leases (Week 3)
- **3.1 Contract Templates**: Merge fields from lease/property/parties.
- **3.2 Signature Capture**: Tenant/Owner signatures, initials, consent; generate PDF; store hash.
- **3.3 Audit Trail**: `contract_audit_logs` events; signer IP/UA.
- **Acceptance**: Signed PDF stored; hash verification passes; audit is immutable.

## Phase 4 – Payments, Receipts, Arrears (Week 4)
- **4.1 Payments Records**: Due dates, grace period, late fees, arrears view.
- **4.2 Receipts**: Generate and store PDF receipts; `receipt_number`, `receipt_url`.
- **4.3 Commission/Net**: Validate commission fields and reports.
- **Acceptance**: Monthly close produces accurate totals; receipts accessible per payment.

## Phase 5 – Maintenance & Job Marketplace (Week 5)
- Modeled after Urban Company [link](https://www.urbancompany.com/)
- **5.1 Requests→Jobs**: Convert `maintenance_requests` into job pipeline: request → quote → assign → in-progress → complete → review.
- **5.2 Quotes & SLAs**: Vendor quotes, ETA, cost approvals, attachments. (Quotes schema added in 1.2 to unblock vendor flow.)
- **5.3 Scheduling**: Use vendor availability; calendar holds; reschedule/cancel.
- **5.4 Reviews & Ratings**: Post-completion rating, comments.
- **Schema Adds**: `jobs` (or extend `maintenance_requests`), `job_quotes`, `job_activities`, `reviews`.
- **Acceptance**: Owner can request service, receive quotes, assign vendor, track to completion, and leave review.

## Phase 6 – Notifications & Messaging (Week 6)
- **6.1 In‑App Notifications**: Rent due/overdue/paid, maintenance updates, inspections, expiring leases.
- **6.2 Channels**: Email and SMS adapters with retry/backoff.
- **6.3 Messaging**: `messages` table UI; property/job thread filters.
- **Acceptance**: Timely notifications; unread counts; basic chat with RLS.

## Phase 7 – Reporting & Analytics (Week 7)
- **7.1 Monthly Earnings Report**: Gross/commission/net, occupancy, arrears.
- **7.2 YTD Dashboard**: Month-wise and per-property aggregates; trend charts.
- **7.3 Occupancy**: Owner-level function for occupancy over a period.
- **Acceptance**: Reports match payments and leases; export CSV/PDF.

## Phase 8 – Mobile Readiness (Week 8)
- **8.1 Capacitor**: Mobile theming, safe-areas, icons/splash.
- **8.2 Offline-lite**: Graceful failure, queued actions for flaky networks.
- **Acceptance**: APK build boots; happy-path flows verified on device.

## Phase 9 – Security, Privacy, Compliance (Week 9)
- **9.1 RLS Review**: Pen test read/write paths, policy least-privilege.
- **9.2 Secrets/PII**: Vault usage for sensitive data, access logs.
- **9.3 Backups & DR**: Export strategy, restoration drills.
- **Acceptance**: Security checklist signed off; advisors clean.

## Phase 10 – QA, UAT, Launch (Week 10)
- **10.1 Automated Tests**: Critical flows (auth, contracts, payments, jobs).
- **10.2 UAT Scripts**: Role-specific acceptance scripts.
- **10.3 Launch Plan**: Rollout, monitoring, support.
- **Acceptance**: UAT pass; incident playbooks ready.

---

## Cross-Cutting Standards
- DB-first; no breaking schema without migration and RLS policy updates.
- Type-safe Supabase usage with `src/types/supabase.ts`.
- UI outside `app/` except route components; Tailwind with Indian palette.
- Public signup allowed; enforce duplicate checks and verification during onboarding.
 - MMS alignment: Dedicated vendors, Quotes → PO → Execution → Closure incorporated where relevant; show a single friendly status and CTA to vendors.

## Dependencies & Sequencing
- Phase 0 must be completed before any user-facing rollout.
- Phases 1→4 build core leasing/payments; 5 adds marketplace behaviors; 6–7 add comms/insights.

## Metrics & KPIs
- Time-to-contract-signed, payment on-time rate, average days in arrears, average job resolution time, vendor rating, repeat jobs.

## Out of Scope (v1)
- Third-party e-sign provider integration (use native first); automated payouts (manual review until v2).

# Contract Detail UI Prompts (Role-specific)

## Owner Contract Detail – Canva AI Prompt

Design a mobile-first (with desktop variant) Owner Contract Detail page for a property management SaaS. Style: clean, modern, Inter font, rounded cards, soft shadows. Color palette: owner-themed blues with sa-green as success.

Context and goals:
- Owner must review, sign/countersign, and see status clearly. Paperless signing and audit trail are critical.
- Contract types: Tenancy (Owner↔Tenant), Service (Owner↔Vendor, optional Tenant).
- States to render: pending_signatures, active, completed.

Layout and components:
- Header: “Contract Details”, role badge “Owner”, subtle blue gradient header, back button.
- Contract Summary Card: title, property address, status pill, created/updated dates, short contract ID.
- Parties Card: Owner, Tenant, Vendor (for service), avatars + role chips.
- Status Timeline: Created → Sent → Signed by Tenant/Vendor → Signed by Owner → Active.
- Signature Panel: tabs “Draw | Type | Upload”, consent checkbox, primary “Sign now”, secondary “Request changes”. After signing: signature thumbnail + timestamp/IP.
- Document Card: “PDF not finalized yet” or “Download PDF” + SHA256.
- Audit Log: actions list (created/viewed/signed/status updates).
- Sticky Footer (mobile): Back (left), Sign now/Download (right).

States: Pending, Active, Completed.

Placeholders: Owner Navin Indraj; Tenant Arsalan Ahmed; Address 123 Test Street, Johannesburg; ID short hash; Status as above.

Deliverables: Mobile and Desktop variants for each state.

---

## Tenant Contract Detail – Canva AI Prompt (updated)

Design a mobile-first (with desktop variant) Tenant Contract Detail page. Style: clean, modern, Inter, rounded cards. Color palette: tenant-themed greens with blue accents.

Context and goals:
- Tenant understands terms, signs quickly, sees countersign status and audit.
- Contract type: Tenancy (Owner↔Tenant). Tenant has at most one active/pending lease.
- States: pending_signatures, active, completed.

Layout and components:
- Header: “Lease Agreement”, role badge “Tenant”, green gradient header.
- Contract Summary: title, property address, status pill, lease period, meta.
- Parties: Owner + Tenant.
- Status Timeline: Created → Sent → Signed by Tenant → Countersigned by Owner → Active. Default shows Tenant at 3rd step; if Owner signs first (edge case), switch Owner to 3rd and Tenant to 4th with “Waiting for signature”.
 - Financial Summary card: Monthly Rent (currency, “Due 1st of each month”), Security Deposit (currency + ‘Outstanding’ chip), Lease Term (“N months” + “Mon YYYY – Mon YYYY”).
 - Pending banner: tenant-green info stripe “Your signature is required to activate this lease agreement”.
- Signature Panel: Draw/Type/Upload tabs, consent, Sign now. After signing: signature thumbnail + timestamp/IP.
- Financial Summary: monthly rent, due day, deposit.
- Document: “PDF not finalized yet” or “Download PDF” + SHA256.
- Audit Log timeline.
- Sticky Footer: Back, Sign now/Download.

States: Pending, Active, Completed.

Placeholders: Tenant Arsalan Ahmed; Owner Navin Indraj; Address 123 Test Street, Johannesburg.

Deliverables: Mobile and Desktop variants for each state.

---

## Vendor Contract Detail – Canva AI Prompt (updated)

Design a mobile-first (with desktop variant) Vendor Contract Detail page. Style: clean, modern, Inter, rounded cards, neutral blue/gray; success sa-green.

Context and goals:
- Vendor reviews Scope & Pricing, signs quickly, sees countersign status and audit.
- Contract type: Service Agreement (Owner↔Vendor, optional Tenant).
- States: pending_signatures, active, completed.

Layout and components:
- Header: “Contract Details”, role badge “Vendor”, neutral gradient header.
- Contract Summary: service title, property address, status pill, meta.
- Scope & Pricing: scope bullets, rate (R amount + unit), call-out fee, service window.
- Parties: Owner, Vendor (and Tenant if required), avatars + role chips.
 - Status Timeline: Created → Sent → Signed by Vendor → Countersigned by Owner (→ Tenant if required) → Active.
   - If Owner signs before Vendor, switch Owner to step 3 and Vendor to step 4 with clear “Waiting for signature” highlight.
 - Service Summary card (Urban Company parity):
   - Selected Service: title, category, rate (R amount + unit), call-out fee (if any), estimated duration.
   - Service Window: date/time slot chosen; “Reschedule” CTA when pending/not yet started.
   - Party Responsibility badges (Materials / Tools / Consumables) showing who supplies.
 - Quote/Price Breakdown (VAT/platform-aware):
   - Base Rate (e.g., R 500/hr × hours or per-job)
   - Call-out/Visit Charge (e.g., R 300)
   - Discount (promo/negotiated)
   - VAT 15% line only if vendor is VAT-registered; otherwise hide VAT line and show note “Vendor not VAT-registered”.
   - Platform Fee (e.g., 10–20%) always shown; vendor sees platform fee line in payout calc.
   - Total (customer pays)
   - Vendor Payout (Total − Platform fee − Discount ± VAT rule) with helper text: “Paid out after job completion as per policy”.
 - Scope of Work card: rich text bullets/numbered lists/links; attachments preview chips (image/PDF name, size, quick view).
 - Signature Panel: Draw/Type/Upload, consent; Request Changes textarea logs to audit; post-sign shows signature thumbnail + timestamp/IP/UA.
 - Document Card: Download PDF + SHA256 (copy button); hidden until all required signatures.
 - Recent Activity: created/sent/viewed/signed/status; hide self-view events for current role.
 - Sticky Footer: Back, Sign/Download; role-themed (Owner blue, Vendor indigo, Tenant green if tri-party).
 - Post-completion: “Convert to invoice” and “Rate service” CTAs.
- Signature Panel: Draw/Type/Upload tabs, consent, Sign now, Request changes. Post-sign: signature thumbnail + timestamp.
- Document: “PDF not finalized yet” or “Download PDF” + SHA256.
- Audit Log.
 - Recent Activity: include created/viewed/signed; hide self-view events (e.g., “Viewed by Vendor” not shown to Vendor).
- Sticky Footer.

States: Pending, Active, Completed.

Placeholders: Owner Navin Indraj; Vendor FixItNow (Pty) Ltd (VAT-registered? yes/no; VAT # 4XXXX… if yes); Tenant Arsalan Ahmed (optional); Address 123 Test Street, Johannesburg; Rate R 500/hr; Call-out R 300; Platform Fee 15%; Total R 1,800; Vendor Payout R 1,530.

Design tokens (for consistent handoff):
- Typography (Inter): H1 20/700; H2 18/600; Card title 16/600; Body 14–16/500; Meta 12–13/500
- Radii: 12px cards; 9999px pills  
- Shadow: y=2, blur=8, 12–15% black  
- Spacing: 8px scale (8, 12, 16, 20, 24)
- Colors: Owner Blue #2563EB (Dark #1E40AF, Light #DBEAFE); Vendor Indigo #4F46E5 (Light #E0E7FF); Tenant Green #059669 (Light #D1FAE5); Amber #D97706 (Light #FEF3C7); Slate #64748B (Light #F1F5F9); Error #DC2626 (Light #FEE2E2)

Config toggles (show in spec):
- vendor.vat_registered: boolean; vendor.vat_number?: string
- platform_fee_percent: number (default 15)
- discount: { type: 'flat'|'percent', amount: number }
- service_window: { start, end, reschedulable: boolean, free_cancel_minutes: number, late_cancel_fee: number }

Deliverables: Mobile and Desktop variants for each state.

Entry points (for designers to include navigations/links where relevant):
- Vendor Home → Active Jobs list → “View Details” navigates to contract detail
- Notifications deep-links → contract detail
- Bottom navbar → Jobs (future list) → contract detail





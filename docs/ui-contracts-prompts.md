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
- Signature Panel: Draw/Type/Upload tabs, consent, Sign now. After signing: signature thumbnail + timestamp/IP.
- Financial Summary: monthly rent, due day, deposit.
- Document: “PDF not finalized yet” or “Download PDF” + SHA256.
- Audit Log timeline.
- Sticky Footer: Back, Sign now/Download.

States: Pending, Active, Completed.

Placeholders: Tenant Arsalan Ahmed; Owner Navin Indraj; Address 123 Test Street, Johannesburg.

Deliverables: Mobile and Desktop variants for each state.

---

## Vendor Contract Detail – Canva AI Prompt (confirm)

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
- Signature Panel: Draw/Type/Upload tabs, consent, Sign now, Request changes. Post-sign: signature thumbnail + timestamp.
- Document: “PDF not finalized yet” or “Download PDF” + SHA256.
- Audit Log.
 - Recent Activity: include created/viewed/signed; hide self-view events (e.g., “Viewed by Vendor” not shown to Vendor).
- Sticky Footer.

States: Pending, Active, Completed.

Placeholders: Owner Navin Indraj; Vendor FixItNow (Pty) Ltd; Tenant Arsalan Ahmed (optional); Address 123 Test Street, Johannesburg.

Deliverables: Mobile and Desktop variants for each state.





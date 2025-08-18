# Release QA Checklist

Use this for each release candidate. All items must be checked or explicitly waived.

## Metadata
- Release version/tag:
- Date:
- Build/Commit:

## Critical Flows (smoke)
- [ ] Auth: login/logout for tenant/owner/vendor
- [ ] Navigation: bottom nav works per role
- [ ] Vendor: contracts list/detail loads without errors
- [ ] Vendor: can upload a document and see it listed
- [ ] Vendor: can sign a contract (happy path)
- [ ] Vendor: actions pages load (update-status, request-changes, message)
- [ ] Owner: dashboard metrics load; maintenance list visible
- [ ] Owner: income page loads; payments list filters; arrears cards render
- [ ] Tenant: dashboard loads; payments page shows next due/history

## Accessibility quick checks
- [ ] Text contrast meets minimum (WCAG AA) on major pages
- [ ] Focus states visible on inputs/buttons
- [ ] Icons have sufficient contrast

## Performance & Stability
- [ ] No console errors on primary flows
- [ ] Network requests resolve within acceptable time (<2s on Wi‑Fi) for main pages
- [ ] No unhandled promise rejections

## Data integrity
- [ ] Supabase writes persist and are visible on refresh (notes, documents, statuses)
- [ ] Arrears logic matches rules (7‑day grace; 8–14: 500; 15–30: 1,000; 31+: 2,000)

## Regression spot checks
- [ ] Existing maintenance flows still load (owner list/new; vendor jobs; quote creation)
- [ ] No broken routes due to dynamic pages

## Sign-off
- Product:
- Tech Lead:
- QA:

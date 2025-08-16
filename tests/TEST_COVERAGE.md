# Test Coverage (Playwright + Appium)

Updated: 2025-08-16

## Web E2E (Playwright)

- Vendor login flow
  - File: `tests/e2e/vendor-login.spec.ts`
  - Steps: login as vendor → assert dashboard widgets.

- Dedicated Vendors management
  - File: `tests/e2e/dedicated-vendors.spec.ts`
  - Steps: owner login → open dedicated vendors → search `appopoleis` → Add → assert appears in top card → toggle Active/Inactive → Remove.

- Owner creates maintenance request and invites vendor
  - File: `tests/e2e/owner-maintenance-invite.spec.ts`
  - Steps: owner login → new maintenance → Invite Vendors → search vendor → submit → vendor login → sees Submit Quote CTA on Jobs page.

## Mobile E2E (Appium/WebdriverIO)

- Owner flow skeleton
  - File: `tests/mobile/specs/owner-vendor-flows.e2e.ts`
  - Steps: owner login → open Dedicated Vendors page (WebView context).

- Vendor flow skeleton
  - File: `tests/mobile/specs/owner-vendor-flows.e2e.ts`
  - Steps: vendor login → open Jobs page (WebView context).

## Notes

- Env vars required: `E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD`, `E2E_VENDOR_EMAIL`, `E2E_VENDOR_PASSWORD` in `.env.local`.
- Playwright config starts the dev server automatically and uses `E2E_BASE_URL` if set.
- Appium tests assume WebView context is detected; selectors use `data-testid` where possible.

## Next Planned Tests

- Owner: Create request → auto-route via dedicated vendors (no manual invites) → assert VQR rows exist via API.
- Vendor: Submit Quote → Owner approves → PO issued → Vendor execution start/complete.
- Contracts: Service contract pricing card renders VAT/platform fee; signature timeline includes vendor.
- Negative cases: search no results, RLS denies non-party data, missing creds skip.

# Client Test — Build 7 (rev 0) — Issue Triage

## Context

- **Build:** `lalarente-1.0.0-build.7-rev.0.apk` (built 2026-10-21, local Gradle release)
- **Session date:** 2026-11-07
- **Testers:** 3 concurrent phones, one per role (owner / tenant / vendor)
  - Credentials sourced from `.maestro/.env` — NOT committed to this file.
    See `OWNER_EMAIL`, `TENANT_EMAIL`, `VENDOR_EMAIL` keys for the live
    test personas.
- **DB state at session start:** 3 accounts total, one per role, clean slate.

## Objective

Capture every defect, UX friction, and parity gap surfaced during the live
three-way testing session so each can be triaged into a GitHub issue + PR plan
after the client leaves.

## Scope

- Owner ↔ Tenant parity (money hub, maintenance, lease lifecycle)
- Owner ↔ Vendor parity (PO flow, quote, payouts)
- Tenant ↔ Vendor parity (job updates, completion verification)
- Visual regressions vs. the RSA-blue (#002395) palette
- SafeAreaView white-band regressions (background agent still finishing owner screens)
- Push notifications across all three roles
- Deep links and navigation

## Non-goals

- PR #191 (Local Services Directory spec) — out of scope for this session
- LAL-134–139 deployment work (PayFast live, push edge fn, bureau keys) —
  tracked separately, not a build-7 issue

# Database seeds

Manual, idempotent SQL for QA — **not** applied automatically.

| File | Purpose |
|------|---------|
| `build5_demo_data.sql` | Demo dispute, Compare applicants, holding deposit |

## Before you run

1. Merge and apply [docs PR #5](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/5) (or read `docs/DB_AUDIT_BUILD5.md` on `main`) for the data snapshot.
2. Confirm staging has the QA lease, payment, and tenant application rows the script expects (UUIDs in team vault).
3. Run `build5_demo_data.sql` in Supabase SQL Editor after security review.

## UUID rationale

| Block | What it does |
|-------|----------------|
| **§1 Dispute** | Inserts one open dispute tied to existing lease/payment rows (`0001` lease, `0003` payment). |
| **§2 Application** | Adds a **second** applicant on 4A Dolphin for owner Compare UI (`0004` row, demo tenant profile). |
| **§3 Holding deposit** | Uses the QA tenant’s **latest existing** `rental_applications` row on that property — not the `0004` insert from §2. |

## Test plan (after run)

- [ ] Owner: Payment disputes list shows the open demo dispute.
- [ ] Owner: Applications on 4A Dolphin shows Compare with 2+ active applicants.
- [ ] Tenant (QA login): Holding deposit screen shows pending deposit for 4A Dolphin.

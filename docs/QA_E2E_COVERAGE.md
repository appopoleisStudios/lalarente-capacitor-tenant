# Build 5 E2E coverage (shipped client fixes)

Maestro tests use **visible UI only** (labels, placeholders, buttons) — you watch the simulator while text is typed and buttons are tapped.

## Coverage map

| Flow file | Merged PR | Client / Sheet 2 | What you see in the video |
|-----------|-----------|------------------|---------------------------|
| `01-tenant-dashboard` | #7 | Dashboard | Login → Your tenancy |
| `05-pr7-tenant-tenancy-shortcuts` | #7 | T9–T12 nav | Each shortcut opens correct screen |
| `06-pr7-tenant-disputes-empty` | #7 | Disputes UX | Payment Disputes + empty copy |
| `07-pr7-tenant-application-pdf` | #7 | Application PDF | Search → Apply → Proof of Income section |
| `08-pr9-tenant-inspections` | #9 | S2-41/42 | Reports + optional inspection alert |
| `03-tenant-maintenance` | #10 | Maintenance | Maintenance list opens |
| `11-pr10-tenant-maintenance-message` | #10 | S2-39 | Message landlord → thread input |
| `12-pr10-tenant-messaging-keyboard` | #10 | S2-10/15 | Type in thread, text stays visible |
| `13-pr10-tenant-lease-pdf` | #10 | S2-24 | My Lease → Download PDF |
| `14-pr10-tenant-maintenance-camera` | #10 | S2-36 | Report an Issue → Camera button |
| `02-tenant-lala-ai` | #6 | Lala | Tenant AI message + reply |
| `04-owner-dashboard` | — | Smoke | Owner Portfolio Dashboard |
| `09-pr9-owner-inspection-conduct` | #9 | S2-17/18 | Inspection rooms checklist |
| `10-pr9-owner-inspection-readonly` | #9 | S2-17/18 | Completed → read-only detail |
| `15-pr7-owner-disputes-empty` | #7 | O5 disputes | Owner disputes empty state |
| `16-pr6-owner-lala-ai` | #6 | Lala | Owner AI message |

**Not in merged PRs (no automated flow yet):** S2-05/43/44 nav, S2-21 photo refresh, S2-26/28 profile PDF picker, vendor seed S2-13/14.

## QA data prerequisites

| Flow | Needs |
|------|--------|
| Most tenant flows | Active lease on `TENANT_EMAIL` |
| `07-pr7-tenant-application-pdf` | Property with **Apply Now** (tenant not already applied) |
| `09-pr9-owner-inspection-conduct` | At least one **in progress** inspection |
| `10-pr9-owner-inspection-readonly` | At least one **completed** inspection |
| `08-pr9-tenant-inspections` | Optional pending inspection for alert |
| `11` / `12` | Maintenance request and/or message thread |
| Lala flows | `GROQ_API_KEY` on Supabase Edge |

Optional: run `database/seeds/build5_demo_data.sql` in Supabase SQL Editor.

## Commands

```bash
# All shipped fixes, live on simulator (no video)
npm run test:e2e:shipped

# Record one MP4 per flow + optional combined demo (for client)
npm run test:e2e:video
```

Output videos: `qa-videos/<timestamp>/` (gitignored).

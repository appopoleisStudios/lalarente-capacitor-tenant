# Client feedback — Maestro E2E + video sign-off

Automated coverage for **Sheet 2** (44-step hands-on test) from the client feedback workbook. Each step maps to a Maestro flow; record MP4s to send Navin for approval.

**Detail per step:** [CLIENT_TEST_RUN_BUILD4.md](./CLIENT_TEST_RUN_BUILD4.md)  
**Build status:** [CLIENT_FEEDBACK_MATRIX.md](./CLIENT_FEEDBACK_MATRIX.md)

## Commands

```bash
# Prerequisites: iOS Simulator (or Android) + dev client running with Metro + .env
# Credentials: .maestro/.env (copy from .maestro/.env.example)

# Run full tenant + owner suite (watch simulator, no video)
npm run test:e2e:client-feedback

# Record one MP4 per flow + combined demo per role (for client)
npm run test:e2e:client-feedback:video
```

**Video retention:** recordings are **not** written to `qa-videos/` unless every flow passes. The script (1) runs the full suite without recording first, (2) records into a temp folder, (3) promotes to `qa-videos/client-feedback-<timestamp>/` only on full green. Failed runs leave `qa-videos/` unchanged.

| Env var | Default | Effect |
|---------|---------|--------|
| `E2E_VIDEO_TEST_FIRST=0` | `1` | Skip pre-flight test; record immediately |
| `E2E_KEEP_FAILED_VIDEOS=1` | off | Keep temp folder when a recording fails (debug) |

**Video output (success only):** `qa-videos/client-feedback-<timestamp>/`

| Folder | Account | Combined demo |
|--------|---------|---------------|
| `tenant/` | Nashin (tenant QA) | `client-signoff-demo.mp4` |
| `owner/` | Navin (owner QA) | `client-signoff-demo.mp4` |

On Mac mini:

```bash
cd ~/Developer/lalarente/lalarente-app
source .env   # Supabase keys — required or app shows red overlay
npm start     # separate terminal
npm run test:e2e:client-feedback:video
```

Zip `qa-videos/client-feedback-*` and share with the client. Individual clips are named by flow file (see mapping below).

## Suite structure

| Orchestrator | Role | Steps |
|--------------|------|-------|
| `client-feedback-suite.yaml` | Both | Runs tenant then owner |
| `client-feedback-tenant-suite.yaml` | Tenant | S2-24 … S2-44 |
| `client-feedback-owner-suite.yaml` | Owner | S2-01 … S2-23 |

Dedicated flows live in `.maestro/flows/client-feedback/`. Shipped PR flows are reused from `.maestro/flows/01`–`18`.

## Sheet 2 → Maestro mapping

### Owner (S2-01 … S2-23)

| Step | Client check | Maestro flow | Notes |
|------|--------------|--------------|-------|
| S2-01 | Dashboard stats | `client-feedback/s2-01-owner-dashboard` | Portfolio + scroll to Documents |
| S2-02 | Bell notifications | `client-feedback/s2-02-owner-bell` | |
| S2-03 | Viewings pending | `client-feedback/s2-03-owner-viewings` | Expired viewing = data-dependent |
| S2-04 | Approve/decline viewing | `client-feedback/s2-03-owner-viewings` | Smart expiry — manual if no pending row |
| S2-05 | Applications entry | `18-pr11-owner-applications` | Needs Applications nav + seed data |
| S2-06 | Application scoring | — | **Manual / docs** — explain scoring in call |
| S2-07 | Accept → lease template | — | **Manual** — client template pending |
| S2-08 | Active leases | `client-feedback/s2-08-owner-leases` | |
| S2-09 | Lease deposit walkthrough | `client-feedback/s2-08-owner-leases` | Partial UI; walkthrough manual |
| S2-10 | Contact tenant → messages | `client-feedback/s2-10-owner-lease-messages` | Keyboard visibility |
| S2-11 | Rent roll overdue | `client-feedback/s2-11-owner-rent-roll` | |
| S2-12 | Payment reminder | `client-feedback/s2-11-owner-rent-roll` | |
| S2-13 | Maintenance vendor routing | `client-feedback/s2-13-owner-maintenance` | Needs vendor seed for full path |
| S2-14 | Assign vendor / open market | `client-feedback/s2-13-owner-maintenance` | Same |
| S2-15 | Chat keyboard (maintenance) | `client-feedback/s2-10-owner-lease-messages` | Overlaps S2-10 keyboard fix |
| S2-16 | Inspections list | `09-pr9-owner-inspection-conduct` | |
| S2-17 | Room checklist | `09-pr9-owner-inspection-conduct` | Needs in-progress inspection |
| S2-18 | Rate rooms / photos | `09-pr9-owner-inspection-conduct` | |
| S2-19 | Messages thread | `client-feedback/s2-19-owner-messages` | |
| S2-20 | Reply | `client-feedback/s2-19-owner-messages` | |
| S2-21 | Property photos refresh | `client-feedback/s2-21-owner-property` | Edit refresh = manual compare |
| S2-22 | Add property | — | **Manual** — creates DB row; avoid in CI |
| S2-23 | Edit property photo | `client-feedback/s2-21-owner-property` | Edit affordance visible |

### Tenant (S2-24 … S2-44)

| Step | Client check | Maestro flow | Notes |
|------|--------------|--------------|-------|
| S2-24 | Dashboard + lease PDF | `01-tenant-dashboard`, `13-pr10-tenant-lease-pdf` | |
| S2-25 | Bell | `client-feedback/s2-25-tenant-bell` | |
| S2-26 | Proof of address PDF | `client-feedback/s2-26-tenant-profile-docs` | |
| S2-27 | Profile fields | `client-feedback/s2-26-tenant-profile-docs` | Profile screen |
| S2-28 | POA (profile) | `client-feedback/s2-26-tenant-profile-docs` | |
| S2-29 | Dashboard POA pending | `01-tenant-dashboard` | Optional banner — data-dependent |
| S2-30 | Lease property name | `13-pr10-tenant-lease-pdf` | |
| S2-31 | Contact owner | `client-feedback/s2-31-tenant-contact-owner` | |
| S2-32 | Payments history | `client-feedback/s2-32-tenant-payments` | |
| S2-33 | Make payment mock | `client-feedback/s2-32-tenant-payments` | |
| S2-34 | Arrears after payment | — | **N/A** in client run (paid) |
| S2-35 | Maintenance history | `03-tenant-maintenance` | |
| S2-36 | New request + camera | `14-pr10-tenant-maintenance-camera` | |
| S2-37 | Requests list | `03-tenant-maintenance` | |
| S2-38 | Messages thread | `12-pr10-tenant-messaging-keyboard` | |
| S2-39 | Maintenance → messages | `11-pr10-tenant-maintenance-message` | |
| S2-40 | Send message | `client-feedback/s2-40-tenant-send-message` | |
| S2-41 | Inspection alert | `08-pr9-tenant-inspections` | Optional pending inspection |
| S2-42 | Tap inspection alert | `08-pr9-tenant-inspections` | |
| S2-43 | Viewing history | `17-pr11-tenant-viewings-applications` | |
| S2-44 | Application status | `17-pr11-tenant-viewings-applications` | |

**Also in tenant suite:** tenancy shortcuts (`05`), disputes (`06`), application PDF (`07`), Lala AI (`02`).

## QA data prerequisites

| Need | Flows affected |
|------|----------------|
| Active lease on tenant account | Most tenant flows |
| Owner portfolio + leases | Owner dashboard, leases, rent roll |
| Pending/completed inspections | `08`, `09`, `10` |
| Maintenance request + thread | `11`, `12`, `s2-40`, `s2-19` |
| Viewing/application rows | `17`, `18`, `s2-03` |
| `GROQ_API_KEY` on Supabase Edge | `02`, `16` |
| Vendor seed (optional) | `s2-13` full assign path |

Run `database/seeds/build5_demo_data.sql` in Supabase if screens are empty.

## Sending videos to client

1. Run `npm run test:e2e:client-feedback:video` on Mac mini with simulator visible.
2. Confirm green run (or note failed clips in README).
3. Zip `qa-videos/client-feedback-<timestamp>/`.
4. Email or Drive: attach `tenant/client-signoff-demo.mp4` and `owner/client-signoff-demo.mp4`, or individual S2-labelled clips.

Failed flows still produce partial videos — fix QA data and re-run only failed YAML files with:

```bash
~/.maestro/bin/maestro record --local \
  --env TENANT_EMAIL=... --env TENANT_PASSWORD=... \
  --env OWNER_EMAIL=... --env OWNER_PASSWORD=... \
  .maestro/flows/client-feedback/s2-25-tenant-bell.yaml \
  qa-videos/retry/s2-25.mp4
```

# Mac Mini E2E Run Guide — Build 5 Release

## Prerequisites

### 1. Verify Setup on Mac Mini

```bash
# Check Maestro installed
~/.maestro/bin/maestro --version

# Check Metro running on port 8081
curl -s http://localhost:8081/status || echo "Metro not running"

# Check simulator running
xcrun simctl list devices | grep Booted

# Check git is on latest main
cd /path/to/lalarente-capacitor-tenant
git pull origin main --no-edit
```

### 2. Configure Credentials

Copy and fill `.maestro/.env`:
```bash
cp .maestro/.env.example .maestro/.env
```

Fill in these values:
```
TENANT_EMAIL=navin.indraj@yahoo.com
TENANT_PASSWORD=<from team vault>
OWNER_EMAIL=indraj.navin@gmail.com
OWNER_PASSWORD=<from team vault>
VENDOR_EMAIL=indraj.navin@gmail.com
VENDOR_PASSWORD=<from team vault>
```

> **Note:** Vendor uses the same account as Owner on dev DB — works because profiles table has vendor role assignment.

### 3. Ensure `.env` has PayFast Sandbox Keys

Keys are already set on the dev machine. When copying to Mac Mini, verify:
```bash
# Check PayFast sandbox keys are present
grep PAYFAST .env
# Should show:
# EXPO_PUBLIC_PAYFAST_MERCHANT_ID=10051626
# EXPO_PUBLIC_PAYFAST_MERCHANT_KEY=8w5clsx87psi2
# EXPO_PUBLIC_PAYFAST_PASSPHRASE=iluvmymomandmywife
# EXPO_PUBLIC_PAYFAST_SANDBOX=true
```

---

## E2E Test Suites — Run Order

### Suite A: Quick Smoke (4 flows)
```bash
npm run test:e2e
```
**Covers:** Tenant dashboard, Lala AI, Maintenance, Owner dashboard

### Suite B: Full Shipped (23 flows — includes vendor parity)
```bash
npm run test:e2e:shipped
# OR directly:
npm run test:e2e -- .maestro/flows/build5-shipped-suite.yaml
```
**Covers:** All 18 shipped flows + 5 new vendor parity flows

### Suite C: Client Feedback (44 Sheet 2 steps)
```bash
# Tenant + Owner full suite
npm run test:e2e:client-feedback

# Or run individually:
npm run test:e2e -- .maestro/flows/client-feedback-tenant-suite.yaml
npm run test:e2e -- .maestro/flows/client-feedback-owner-suite.yaml
```

### Suite D: Record Video Sign-off
```bash
# Record MP4 per flow for client demo
npm run test:e2e:client-feedback:video
```
Videos saved to `qa-videos/client-feedback-<timestamp>/` (only on full suite pass)

---

## New Vendor Parity Flows (Added in this release)

| Flow | File | What it tests |
|------|------|---------------|
| Vendor Dashboard | `vendor-dashboard.yaml` | Login → dashboard stats cards (Available, Quotes, Active, Completed) |
| Vendor Notifications | `vendor-notifications.yaml` | Notification bell → notifications screen → empty/all-caught-up state |
| Vendor Messaging | `vendor-messaging.yaml` | Messages tab → threads list → empty state |
| Vendor Maintenance | `vendor-maintenance.yaml` | Maintenance requests list |
| Vendor AI Chat (Lala) | `vendor-ai-chat.yaml` | AI chat → send message → wait for reply |

All vendor flows rely on new `login-vendor.yaml` subflow (in `.maestro/subflows/`).

---

## QA Parity Test Flows — Manual Checklist

Run these **after** Maestro automation passes. For each flow, test on simulator and verify both sides.

### Authentication (Flow 1)
- [ ] Registration works for all 3 roles
- [ ] Login/logout works
- [ ] Session persists after app close/reopen
- [ ] Wrong password shows error

### Profile Management (Flow 2)
- [ ] Owner/tenant profile shows real data
- [ ] Edit & save profile works
- [ ] Tenant verification status on dashboard
- [ ] Proof of address upload

### Property Management (Flow 3)
- [ ] Owner adds property
- [ ] Tenant searches properties
- [ ] Property edit reflects on both sides

### Viewing Requests (Flow 4) ⭐
- [ ] Tenant requests viewing
- [ ] Owner approves/declines
- [ ] Decline with alternative times
- [ ] Tenant cancels
- [ ] All statuses visible on both sides

### Rental Applications (Flow 5) ⭐
- [ ] Tenant applies
- [ ] Owner reviews & approves/rejects
- [ ] Holding deposit request
- [ ] Application competition (2+ applicants)

### Holding Deposits (Flow 6)
- [ ] Owner requests → Tenant pays → Owner refunds
- [ ] Applied to lease flow

### Lease Creation & Signing (Flow 7) ⭐
- [ ] Owner creates lease
- [ ] Both parties sign
- [ ] Property status updates to "Rented"
- [ ] Lease PDF downloadable

### Payments (Flow 8) ⭐
- [ ] Tenant pays rent (EFT mock)
- [ ] Owner confirms payment
- [ ] Payment dispute lifecycle
- [ ] Arrears escalation

### Maintenance (Flow 9) ⭐
- [ ] Tenant reports issue with photo
- [ ] Owner assigns vendor
- [ ] Vendor submits quote → Owner approves
- [ ] PO workflow
- [ ] Work progress updates
- [ ] Closure verification
- [ ] **Vendor parity**: All 3 sides see correct status

### Inspections (Flow 10)
- [ ] Owner schedules inspection
- [ ] Room-by-room checklist works (S2-17/18 regression check)
- [ ] Both parties sign
- [ ] PDF export

### Lease Renewal (Flow 11)
- [ ] CPA 80-day notice
- [ ] Owner sends offer → tenant accepts/counters
- [ ] Execute renewal

### Early Termination (Flow 12)
- [ ] Tenant requests → Owner accepts/rejects
- [ ] Deposit refund auto-trigger

### Deposit Management (Flow 13)
- [ ] Deposit interest tracking
- [ ] Deductions with reasons
- [ ] Finalise refund

### Documents (Flow 14)
- [ ] Owner: Document Hub (12 tiles)
- [ ] Tenant: Upload ID, proof of income, proof of address

### Notifications (Flow 15)
- [ ] Owner bell shows correct badges
- [ ] **New**: Vendor notifications screen works
- [ ] Tap notification navigates correctly

### Messaging (Flow 16)
- [ ] Owner → Tenant messaging
- [ ] **New**: Vendor messages screen works
- [ ] Keyboard visibility (S2-10/15 regression check)

### Insurance Claims (Flow 17)
- [ ] Create claim → add docs → submit → track

### POPIA / Privacy (Flow 18)
- [ ] **New**: Vendor privacy screen works
- [ ] DSAR request
- [ ] Consent settings

### Vendor-Specific Parity Checklist
- [ ] Vendor dashboard loads with stats
- [ ] Vendor notifications screen works
- [ ] Vendor messaging (threads + compose)
- [ ] Vendor AI Chat (Lala) works
- [ ] Vendor privacy/POPIA screen
- [ ] Vendor maintenance list + detail
- [ ] All vendor tabs navigate correctly

---

## Regression Checklist

- [ ] No login prompt after swipe-close (GEN-001)
- [ ] Owner Profile shows real name (OWN-002)
- [ ] Tenant Profile save works (TEN-004)
- [ ] Email field shows correct auth email (TEN-001)
- [ ] Date of Birth shows date picker (TEN-002)
- [ ] Phone country code picker works (TEN-003)
- [ ] Proof of address upload without Edit (TEN-005)
- [ ] Verification card disappears after completion (TEN-007)
- [ ] No emoji icons in Login/Register (GEN-003)
- [ ] Analytics grid uses Ionicons (GEN-003)
- [ ] Documents tiles use Ionicons (GEN-003)
- [ ] Inspection crash regression (S2-41/42 fix)
- [ ] Inspection rooms regression (S2-17/18 fix)
- [ ] Keyboard does not cover input (S2-10/15 fix)
- [ ] Camera upload works (S2-36 fix)
- [ ] Property photo refresh after edit (S2-21 fix)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Maestro not installed | `curl -Ls "https://get.maestro.mobile.dev" \| bash` |
| App not found on simulator | `npx expo run:ios` to build dev client |
| Login timeout | Check `.maestro/.env` credentials are filled |
| Vendor flows fail | Check VENDOR_EMAIL/VENDOR_PASSWORD in `.maestro/.env` |
| "Maestro not found" | `export PATH="$PATH:$HOME/.maestro/bin"` |
| `git pull` opens vim | `GIT_EDITOR=true git pull origin main --no-edit` |
| Metro not running | `npm start` in separate terminal |

---

## Before Sending to Client

1. [ ] All Maestro suites pass (A → B → C)
2. [ ] All QA parity manual flows tested
3. [ ] Regression checklist fully green
4. [ ] Video recordings captured (`npm run test:e2e:client-feedback:video`)
5. [ ] Zip `qa-videos/` folder and share with client
6. [ ] Tag release: `git tag -a v1.0.0-build.5-rev.0 -m "Build 5 - Full vendor parity"`
7. [ ] Trigger EAS build for APK: `eas build --platform android --profile preview`

---

**Build 5 ships:** All client feedback fixes + Full vendor parity (notifications, messaging, AI chat, privacy, POPIA)

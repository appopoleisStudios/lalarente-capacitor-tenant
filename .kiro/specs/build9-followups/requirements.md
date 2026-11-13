# Build 9 Follow-ups — Requirements

## Context

- **Build:** `lalarente-1.0.0-build.9-rev.0.apk` (2026-11-13, local Gradle release)
- **Source:** lifecycle E2E chain run on the iOS simulator (iPhone 16e) and the
  Android emulator (Pixel 7) on 2026-11-13, plus owner feedback in that session.
- **Branch at start:** `feat/lifecycle-inspection-issues-deposit-confirm`
  (commits `9d56351`, `7a28d6a`).
- Credentials live in `.maestro/.env` — never in this file.

## Objective

Close every item left open after build 9, one task at a time, each on its own
branch → PR → merge, with on-device testing after every merge.

## Working rules

- One task per branch (`fix/b9-0NN-…` / `feat/b9-0NN-…`), PR into `main`.
- DB changes only via `supabase/migrations` + `supabase db push --linked`.
- After each merge: iOS simulator (Maestro) **and** Android emulator with a
  freshly built APK — the APK is the deliverable, not the iOS build.
- `tenant-tabbar-guard.yaml` must pass after any `_layout.tsx` change.
- Never change the EAS build profile.

## Non-goals

- PayFast / Yoco live payments, FCM push — tracked separately.
- UI redesign of long screens until the Twitter-intel DB search works (B9-006).

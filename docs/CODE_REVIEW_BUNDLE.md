# Code review bundle — build 5 train

Use this when reviewing **application code** in one pass. Docs and seed PRs are separate (no app logic).

**Last updated:** 2026-06-04

## Quick filter

| Review? | PR | Branch | Type |
|---------|-----|--------|------|
| **No (docs only)** | — | `main` | #5 merged — SDLC, matrix, test run |
| **No (SQL only)** | — | `main` | #8 merged — manual seed script |
| **Yes — code** | [#9](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/9) | `fix/p0-inspections` | P0 inspections |
| **Yes — code** | [#7](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/7) | `feat/p0-tenant-ux` | P0 tenant UX |
| **Yes — code** | [#10](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/10) | `fix/p1-messaging-maintenance-ux` | P1 messaging + maintenance |
| **Yes — code** | [#6](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/6) | `feat/ai-chat-edge` | Lala AI + Edge |
| **Skip / close** | [#4](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/4) | `feat/lalarente-ai-chat-screen` | Superseded by #6 (mocks) |

## Suggested review order (code only)

1. **#9** — Inspection crashes + owner conduct (blocks APK)
2. **#7** — Tenant nav, PDF application uploads, dispute copy
3. **#10** — Keyboard, maintenance camera upload, message-from-maintenance, lease PDF
4. **#6** — AI chat UI + `lala-ai-chat` Edge (after UX stable)

## What each code PR touches

### PR #9 — Inspections (P0)
- `src/features/inspections/utils/normalizeRooms.ts` (new)
- `src/features/inspections/screens/InspectionScreen.tsx`
- `app/(owner)/inspections/[id].tsx` → conduct screen
- `src/features/tenant/screens/TenantDashboardScreen.tsx` (alert nav)

**Sheet 2:** S2-17, S2-18, S2-41, S2-42

### PR #7 — Tenant P0 UX
- `TenantDashboardScreen.tsx` — Your tenancy shortcuts
- `TenantApplicationScreen.tsx` — PDF-only income/reference
- `OwnerPaymentDisputesScreen.tsx`, `TenantPaymentDisputeScreen.tsx` — empty states

**Sheet 2:** T9, T10, T12, O5 (nav), application PDF

### PR #10 — Messaging + maintenance + lease (P1)
- `MessageThreadScreen.tsx`, `ComposeMessageScreen.tsx` — keyboard / safe area
- `app.config.js` — `softwareKeyboardLayoutMode: resize` (Android)
- `useMediaUpload.ts` — camera upload via FileSystem (not `fetch(uri)`)
- `TenantMaintenanceListScreen` + detail — property address on tile, message landlord
- `messagesApi.getOrCreateThread` — category-scoped lookup
- `TenantLeaseScreen.tsx` — lease PDF download + property relation unpack

**Sheet 2:** S2-10, S2-15, S2-36, S2-39, S2-24, S2-30

### PR #6 — Lala AI
- `supabase/functions/lala-ai-chat/index.ts`
- `src/features/ai-chat/*`, `app/(tenant|owner)/ai-chat.tsx`
- `docs/LALA_AI_DEPLOY.md`

**Post-merge:** set `GROQ_API_KEY`, deploy Edge function.

## Conflicts / stacking

- Branches are based on **`main`** (includes merged #5 and #8).
- **#7**, **#9**, **#10** may touch `TenantDashboardScreen.tsx` — merge **#7** first, then rebase **#9** / **#10** if GitHub shows conflicts.
- **#6** is largely isolated (`ai-chat` routes + Edge).

## SA / security (already addressed on earlier PRs)

- #5: PII removed from docs; MCP gitignored
- #6–#8: SA follow-up commits pushed; re-review before merge

## APK gate (after code merges)

- [ ] P0 Sheet 2 crashes pass on device (inspections + smoke tenant/owner login)
- [ ] Merge order above
- [ ] Deploy `lala-ai-chat` per `docs/LALA_AI_DEPLOY.md`
- [ ] Optional: run `database/seeds/build5_demo_data.sql` in SQL Editor (not in APK)

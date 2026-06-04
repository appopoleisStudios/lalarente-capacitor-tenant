# Release train & SDLC

## Supabase project

- **project_ref:** `vvepwaolnkzfzhzgxlwr`
- **API URL:** `https://vvepwaolnkzfzhzgxlwr.supabase.co`
- **MCP (this repo):** [`.cursor/mcp.json`](../.cursor/mcp.json)

## SDLC (every feature / PR)

1. **Ask** — Matrix row IDs + agent questions; optional **Claude** advisory (paste reply in PR).
2. **Build** — Feature branch; minimal diff.
3. **Review** — Human PR review (you / Navin).
4. **Address comments** — Agent commits on same PR.
5. **Push PR** — `gh pr create`; link matrix rows + test plan.
6. **SA** — Security audit checklist (below).
7. **Merge** — **Human only** (squash).
8. **Continue** — Next backlog row.

## Branch rules

- `main` is protected; no direct commits for features.
- One matrix slice (or small related group) per PR.
- Version / APK: `chore/build-N` PR after feature PRs merge.

## Security audit (SA) checklist

- [ ] No secrets in git (`.env` gitignored)
- [ ] Edge functions require JWT; service role only server-side
- [ ] New SQL migrations idempotent; no destructive prod data in seed PRs
- [ ] RLS considered for new tables; existing RLS gaps tracked (see [DB_AUDIT_BUILD5.md](./DB_AUDIT_BUILD5.md))
- [ ] POPIA: AI prompt does not leak other users’ data
- [ ] Client uses anon key only; Groq key in Supabase secrets

## QA logins

| Role | Email |
|------|-------|
| Owner (Navin) | indraj.navin@gmail.com |
| Tenant (Nashin) | navin.indraj@yahoo.com |

See [DB_AUDIT_BUILD5.md](./DB_AUDIT_BUILD5.md) for IDs and lease.

## Build numbering

Last shipped on `main`: **1.0.0-build.4-rev.2**  
Next target: **1.0.0-build.5-rev.0**

## PR stack (build 5)

Authoritative order (mirrors [CLIENT_TEST_RUN_BUILD4.md](./CLIENT_TEST_RUN_BUILD4.md) § Recommended PR stack).

| Order | Branch / PR | Matrix / S2 | Gate |
|-------|-------------|-------------|------|
| 0 | `docs/release-control-sdlc` ([#5](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/5)) | Tracker + Sheet 2 | Merge first |
| 1 | `feat/p0-tenant-ux` ([#7](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/7)) | T7; partial Nav-gap T9–T13, T16 nav | Not S2 crashes |
| 2 | `feat/ai-chat-edge` ([#6](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/6)) | N1 | Deploy Edge after merge |
| 3 | `feat/qa-seed-build5` ([#8](https://github.com/appopoleisStudios/lalarente-capacitor-tenant/pull/8)) | O6/O7/O13 **data** — not O5 nav | Manual SQL |
| 4 | `fix/inspection-crash-tenant` | **S2-41, S2-42** (P0) | T16/T17 crash — **before APK** |
| 5 | `fix/owner-inspection-rooms` | **S2-17, S2-18** (P0) | Before APK |
| 6 | `fix/messaging-keyboard` | S2-10, S2-15 | |
| 7 | `fix/maintenance-messages-camera` | S2-36, S2-39 | |
| 8 | `fix/tenant-lease-pdf` | S2-24, S2-30 | |
| 9 | `fix/profile-docs-pdf-picker` | S2-26, S2-28 | |
| 10 | `fix/property-photo-refresh` | S2-21 | |
| 11 | `fix/owner-applications-nav` | **S2-05**, S2-43, S2-44; **O5 nav** (with #8 data for Compare) | |
| 12 | `feat/qa-vendor-seed` | S2-13, S2-14 | Optional; may extend #8 |
| — | `chore/security-rls-messaging` | N2 | Security |
| — | `chore/build-5-apk` | Build 5 | **After P0 rows 4–5 merge** |

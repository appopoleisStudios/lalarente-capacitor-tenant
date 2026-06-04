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

| Order | Branch | Matrix |
|-------|--------|--------|
| 0 | `docs/release-control-sdlc` | Sheet 1 + **Sheet 2** tracker, [CLIENT_TEST_RUN_BUILD4.md](./CLIENT_TEST_RUN_BUILD4.md) |
| 1 | `feat/p0-tenant-ux` | T7; partial **Nav-gap** T9–T13, T16–T17 (not a substitute for Sheet 2 bugs) |
| 2 | `feat/ai-chat-edge` | N1 |
| 3 | `feat/qa-seed-build5` | **Data only** — does not fix Nav-gap or S2 crashes |
| 4 | `fix/inspection-crash-tenant` | S2-41, S2-42 (P0) |
| 5 | `fix/owner-inspection-rooms` | S2-17, S2-18 (P0) |
| 6 | `fix/messaging-keyboard` | S2-10, S2-15 |
| 7+ | See Sheet 2 table | Maintenance, lease PDF, property photos, owner Applications nav, etc. |
| — | `chore/security-rls-messaging` | N2 |
| — | `chore/build-5-apk` | After P0 Sheet 2 crashes fixed |

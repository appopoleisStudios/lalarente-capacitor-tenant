# Product inventory — anti-hallucination method

Chat is not the catalog. The catalog is **files regenerated from the tree**. If this folder and `scripts/generate-product-inventory.mjs` disagree with a sentence in Slack or Plane, **trust the generated JSON**.

## How memory works

1. Sweep the repo with the generator (no model memory).
2. The generator **writes a file after each phase** under `docs/inventory/generated/` so a crash does not lose earlier phases.
3. Humans (and agents) **only narrate** from those files. Do not invent screens that are not in `01-routes.json`.
4. Re-run after any merge: `node scripts/generate-product-inventory.mjs`

## What is counted (honest limits)

| Layer    | Source                                                                                          | Not counted                                                       |
| -------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Routes   | `app/**/*.tsx` leaf files                                                                       | Expo auto-layout internals                                        |
| Screens  | `src/features/**/screens/*.tsx`                                                                 | styles-only files still listed                                    |
| Taps     | `testID`, `onPress=`, `router.push`/`replace`/`href`, `<TextInput`                              | Views with no handler; mapped list rows (under-count)             |
| APIs     | `export async function` / `async name(` in `*.api.ts`                                           | Supabase RLS, Edge functions unless named in `supabase/functions` |
| Sleepers | `TODO: Integrate`, planned-vendor strings, API methods with **zero** callers outside their file | Runtime-dead UI that still has an `onPress`                       |

Inspection checklists, quote line items, and per-property upload rows are **generated in loops**. Static tap counts **under-count** those flows. See `generated/09-loop-multipliers.json`.

## Planned vs built

February 2026 analysis (`docs/COMPLETE_FLOW_ANALYSIS_SUMMARY.md`) pointed at `docs/flows/` and `docs/analysis/` — **those directories are gone from the repo**. The summary file is the surviving “what we planned.” Current truth is the generated inventory + live screens.

## Sleeper definition

A **sleeper** is UI or schema that implies a product capability, but the action never calls a third party (or never calls anything):

- DB columns + status rows (credit / background / identity)
- API `initiate*` that only sets `pending` + `TODO: Integrate`
- **Zero UI callers** of that API
- Compliance FICA rows with no Start button

Those are revive candidates, not deleted features.

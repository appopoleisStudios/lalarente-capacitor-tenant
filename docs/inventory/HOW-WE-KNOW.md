# How we know something works (or does not)

Reading code is **not** proof. A function can exist and never run. A screen can exist and never open.

We use three layers. A feature is only **trusted** if layer 2 and 3 both say yes.

| Layer                       | What it answers                                                            | What it cannot answer                                          |
| --------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Code                     | Is there a function / column / screen file?                                | Does anyone tap it?                                            |
| 2. Wiring graph             | Does a button call that function? Does a screen `push` to the next screen? | Does it work on a phone?                                       |
| 3. Maestro on the simulator | Did we actually tap it, and did the next thing appear?                     | File pickers, PayFast website, TPN bureau, drawing a signature |

Gortex (external code graph) is **down** in this environment. Until it is back, layer 2 is: who-calls-whom from the inventory script + `router.push` list. That is weaker than Gortex, but it is still a graph, not a guess.

## What Maestro already covers (suite list)

Tenant / owner / vendor flows in `scripts/run-full-e2e-suite.sh`. Examples: dashboards, payments smoke, inspections, applications **list**, compliance **upload buttons**, messages, vendor quotes path.

What the suite **never** did until now: prove FICA Identity/Credit/Background has **no Start**. Applications Maestro (`18-pr11`) only opens the **list**, not the screening rows on one application.

## Overlay file

After `node scripts/generate-proof-coverage.mjs`:

`docs/inventory/generated/MAESTRO-COVERAGE.md`

- **Maestro mentions** = a yaml talks about that screen’s testID or deep link
- **No testID** = we cannot even aim Maestro at that screen
- **Unproven** = testIDs exist but no yaml uses them

Mention ≠ last run passed. You still have to run Maestro.

## Screening (LAL-121)

Owner Compliance → FICA → **Run screening** writes RSA ID / affordability / reference results.

`.maestro/flows/owner-screening-unwired.yaml` — open Compliance → FICA → tap Run screening when a tenant card exists.

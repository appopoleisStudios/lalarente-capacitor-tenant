# Sleeper / dead flows (read from code + generated JSON)

Source of truth: `generated/05-apis.json` (orphan methods), `generated/06-stubs-todos.json`, and the files named below.  
Regenerate first: `npm run inventory`.

A **sleeper** has schema and/or UI that _looks_ like the product, but the capability never runs.

---

## Confirmed: tenant screening (your example)

**Planned (Feb 2026):** TPN RentCheck® before lease. Files `docs/flows/01_tenant_screening_flow.md` and `docs/analysis/*` are **not in the repo anymore** — only `docs/COMPLETE_FLOW_ANALYSIS_SUMMARY.md` remains.

**What is built:**

| Layer       | State                                                                                                                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB          | `rental_applications.background_check_status/result`, `credit_check_status/result/at`, `identity_verification_status` (`src/types/database.types.ts`)                                                                                  |
| API         | `applicationsApi.initiateBackgroundCheck`, `initiateCreditCheck`, `verifyIdentity` — **set status to `pending` only**                                                                                                                  |
| TODO in API | `TODO: Integrate with background check service`; `TransUnion`; `Onfido or Smile Identity`                                                                                                                                              |
| UI          | Owner application detail **displays** three `ScreeningRow`s. Compliance FICA tab **displays** identity/credit/background as “Not started”. Tenant application status **shows** credit badge. Competition screen **shows** credit label |
| Callers     | **Zero** UI or other-file callers of the three `initiate*` methods (`generated/05-apis.json` orphans)                                                                                                                                  |
| Consent     | POPIA `data_sharing_credit` exists (“Allows landlords to perform credit checks”) — consent can be granted **without any bureau call**                                                                                                  |

**Revive path:** wire TPN (planned) or TransUnion (TODO comment) behind `initiateCreditCheck` / `initiateBackgroundCheck`; add owner CTAs that call them; gate **Create lease** on completed checks + `data_sharing_credit` consent; FICA Start buttons should call the same APIs, not a second fake status.

Until then this is a **display-only compliance costume**.

---

## Other sleepers (API exists, no callers outside file)

From `generated/INDEX.md` orphans — product-shaped, not private helpers:

| Method                                        | File                    | Why it matters                       |
| --------------------------------------------- | ----------------------- | ------------------------------------ |
| `initiateBackgroundCheck`                     | `applicationsApi.ts`    | Screening                            |
| `initiateCreditCheck`                         | `applicationsApi.ts`    | Screening                            |
| `verifyIdentity`                              | `applicationsApi.ts`    | FICA / Onfido                        |
| `calculateDepositRefund`                      | `inspectionsApi.ts`     | Move-out money from inspection delta |
| `compareInspections`                          | `inspectionsApi.ts`     | Move-in vs move-out                  |
| `cancelInspection`                            | `inspectionsApi.ts`     | Schedule without cancel              |
| `finalizeInspection`                          | `inspectionsApi.ts`     | Alternate complete path              |
| `getMoveInInspection` / `getLeaseInspections` | `inspectionsApi.ts`     | Likely unused helpers                |
| `getExpiringDocuments` / `getDocumentStats`   | `documentsApi.ts`       | Hub “needs attention” for certs      |
| `getPropertyDeposits`                         | `holdingDeposit.api.ts` | Owner portfolio deposits             |

(Private helpers like `getAccessToken` in `lalaChatApi.ts` are **not** sleepers.)

---

## Planned third parties vs what shipped

Feb 2026 summary vs 2026-08 tree:

| Planned                 | In summary                  | In app now                                                                                                                   |
| ----------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| TPN RentCheck           | Required                    | **String only** (docs + comments)                                                                                            |
| SigniFlow / DocuSign    | Required                    | **Local** `react-native-signature-canvas` on inspections/leases — not SigniFlow                                              |
| PayFast / Stitch / Ozow | “NO payment gateway” in Feb | **PayFast** vendor-pay + rent paths exist (Edge `create-vendor-payment-checkout`, `payment-webhook`) — analysis is **stale** |
| PayProp trust account   | PPRA                        | **Docs only**                                                                                                                |
| Entegral → Property24   | Syndication                 | **Docs only**                                                                                                                |
| Onfido / Smile          | ID                          | **TODO comment only**                                                                                                        |
| TransUnion              | Credit                      | **TODO comment only**                                                                                                        |
| WhatsApp Business       | Comms                       | Not found in `src/` inventory sweep                                                                                          |

---

## UI that implies action but does not start screening

- `OwnerComplianceScreen` FICA: Identity / Credit / Background rows, no `onPress` to `initiate*`
- `OwnerApplicationDetailScreen` Screening Status: read-only rows
- Approve application / Create lease: **not gated** on check completion (approve still navigates to lease create)

---

## Lost planning memory

`docs/COMPLETE_FLOW_ANALYSIS_SUMMARY.md` still lists `docs/flows/CORRECTED_01…07` and `docs/analysis/COMPREHENSIVE_GAP_ANALYSIS.md`. **Glob = 0 files.** The year of “what we needed” was partly deleted. This inventory folder is the replacement; do not restore by inventing those docs from the summary table.

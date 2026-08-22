# Flow trees (interpreted from generated routes — not from chat memory)

Route list: `generated/INDEX.md`.  
Parity: `generated/08-parity.json`.  
Static tap floor: `generated/03-taps.json` → **852 `onPress`, 180 inputs, 434 `router.*`, 548 `Alert.alert`**.  
Loops: `generated/09-loop-multipliers.json` → one inspection conduct **~157 taps**; ×3 types × N leases.

`—` in parity means that role has no route for that family (not a bug by itself).

---

## 0. Auth

```
login → (role home)
register → consent capture → role home
signout
```

Routes: `app/auth/login.tsx`, `register.tsx`, `signout.tsx`.

---

## 1. Listing → viewing → apply → screen → lease → occupy

```
TENANT                         OWNER
search                         properties / add-property / edit / view3d
  → properties/[id] (+view3d)
  → viewings/request → viewings → viewings/[id]
                               viewings → viewings/[id]
  → apply/[propertyId]  (4 steps: Personal → Employment → Documents → Review)
  → applications/[id] / application-status
                               applications → applications/[id]
                               application-competition
                               holding-deposit  ↔  tenant holding-deposit
                               leases/create → leases/[id] (PDF, send, sign)
  lease / lease-journey / lease-renewal
                               renewals
```

**Sleeper on this tree:** screening columns + `initiate*` APIs, never called. Lease can proceed without TPN/credit/ID.

---

## 2. Money (rent, arrears, disputes, deposits, tax)

```
TENANT                         OWNER                         VENDOR
payments (PayFast)             rent-roll
arrears                        arrears
payment-disputes               payment-disputes
deposit                        deposits
holding-deposit                holding-deposit
                               statements / tax-reports / invoices
```

Vendor rent: `—`. Vendor money is **earnings + banking** (family `vendor-pay-earnings`).

---

## 3. Maintenance / quote / PO / contract / pay vendor

This is not one screen. Routes from INDEX:

```
TENANT report → maintenance → maintenance/[id]
  → verify / closure-confirm
  → vendor-payments → [invoiceId] → checkout → result

OWNER maintenance / new / [id]
  → select-vendors → quote/[quoteId]
  → send-po → po/[poId]
  → progress-timeline → review-closure → invoice
  → history/[propertyId]

VENDOR maintenance (requests) → [id] → quote/new|edit|[quoteId]
  → po/[poId]
  jobs → [id] → progress-update → request-closure → submit-invoice
  contracts / contracts/[id]
  earnings / banking
```

Parity: tenant has **no** quote/PO routes (correct). Vendor has **no** owner invoice-approval route (owner-only).

---

## 4. Inspections + tenant reports

```
OWNER inspections → new (schedule) → inspections/[id] (conduct: 10 rooms × 82 items)
  → signatures → PDF → documents
TENANT reports (list inspections + closures + work-order PDFs)
  → inspections/[id] (sign / read)
VENDOR —
```

Orphan APIs: `compareInspections`, `calculateDepositRefund`, `cancelInspection` — move-out money from inspection is **not wired to deposit refund UI**.

---

## 5. Compliance / FICA / documents / insurance

```
OWNER compliance (FICA display + property cert uploads)
  documents hub → 13 destinations (tenants, invoices, tax, insurance, deposits, …)
  insurance → new → [id]
TENANT documents (ID upload / FICA copy)
VENDOR profile/documents
```

FICA modules per tenant: identity, credit, background — **display only**.

---

## 6. Tenancy exceptions

```
early-termination     T + O
lease-renewal / renewals
payment-disputes
arrears (7/14/21)
```

---

## 7. Shared rails (all three roles)

dashboard, profile, ai-chat, messages (+ thread + compose), notifications, privacy, DSAR (`privacy/data-rights`).

Vendor contracts nested under profile/dashboard (not a tab).

---

## 8. Admin (web, not mobile tabs)

14 pages under `admin/src/pages`: Dashboard, Users, Properties, Leases, Maintenance, Payments, VendorPayouts, Login, plus Dev\* tools.

---

## 9. Lala

`lala-ai-chat` Edge only. No tools in `lalaChatApi.ts` (reply string). Cannot run screening, inspection, quote, or DSAR.

---

## Tap math (why ≥1000)

| Bucket                              | Conservative            |
| ----------------------------------- | ----------------------- |
| Static onPress in TSX               | 852                     |
| TextInputs                          | 180                     |
| One inspection conduct              | ~157 (loop, not in 852) |
| Three inspection types × one lease  | ~470                    |
| Application 4-step + uploads        | dozens                  |
| MMS quote/PO/closure/photos         | dozens–hundreds per job |
| Compliance × N properties × 6 certs | 6N picker flows         |
| FICA × tenants × 3 (if ever wired)  | 3T                      |

Walking **every unique control once** already exceeds 1000. Walking **every job on a real portfolio** is thousands.

---

## How to extend this tree without hallucinating

1. `npm run inventory`
2. Add a family to `phaseParity` in `scripts/generate-product-inventory.mjs` if a new route cluster appears
3. Add a sleeper only if it appears in `05-apis.json` orphans or `06-stubs-todos.json`
4. Do not cite `docs/flows/` until those files exist again

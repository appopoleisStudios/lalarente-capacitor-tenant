# E2E Lifecycle Board

Linear execution. One lifecycle at a time. Current lifecycle must pass
**complete end-to-end including destructive terminal action** before
moving to the next.

Status key: ⬜ not started · 🟨 in-progress · ✅ pass · ❌ fail

---

## L01 — Rent payment ✅

Terminal: tenant Confirm Payment → owner Confirm Receipt → payment.status=completed in DB.
**Verified:** E2E-01 passes; DB confirmed status flipped pending→processing→completed; owner Rent Roll Monthly Income reflects.

## L02 — Maintenance 3-way (owner-dispatched) ✅

**Verified end-to-end on E2E-185152 (quote 3aa3f6d5, PO-20261020-7131).**

- UI (Maestro): tenant create → owner view (auto-dispatch) → vendor submit quote → owner accept → PO issued
- DB (SQL): startWork → requestClosure → approveClosure (UI blocked by Maestro camera/photo-upload limitation on sim)
- Terminal DB: `maintenance_requests.status='completed'`, `closure_reports.status='approved'`, `quotes.status='approved'`, `purchase_orders.status='issued'`
  Flows: `e2e-02a-vendor-quote.yaml`, `e2e-02b-owner-accept.yaml`.
  Terminal verification: `scripts/e2e-db.sh "select status from maintenance_requests where title='E2E-185152'"`

## L03 — Direct tenant→vendor maintenance ⬜

Phases: tenant picks vendor at report → vendor accepts → quote → tenant pays via PayFast → vendor payout → closure chain.
Terminal: payment.status=completed + vendor_payouts row + request.status=completed.

## L04 — Viewing ⬜

Terminal: tenant submits → owner approves → tenant marks attended → owner marks complete.

## L05 — Application → holding deposit → lease ⬜

Terminal: tenant application → owner shortlist → owner requests holding deposit → tenant pays → owner selects winner → lease created from application.

## L06 — Lease creation + dual signing ⬜

Terminal: owner creates lease from accepted application → tenant signs → owner countersigns → lease.status=active, signature\_\* columns populated.

## L07 — Lease renewal ⬜

Terminal: owner sends renewal offer → tenant accepts → owner executes → new lease active + old lease.status=renewed.

## L08 — Early termination + auto-refund ⬜

Terminal: tenant submits request → owner accepts → lease.status=early_terminated + deposit_refund row created with penalty_amount set + tenant sees refund status.

## L09 — Deposit refund (owner-driven, normal end) ⬜

Terminal: owner initiates refund → deductions proposed → finalized → tenant sees final payout amount + deposit balance zeroed.

## L10 — Arrears + cure plan ⬜

Terminal: owner marks arrears → tenant proposes plan → owner accepts → arrears_arrangement.status=accepted + CPA cure period countdown visible.

## L11 — Payment dispute ⬜

Terminal: tenant raises dispute → owner marks under review → owner accepts/rejects → dispute.status=resolved.

## L12 — Insurance claim ⬜

Terminal: owner creates claim → attaches docs → submits → status progresses through under_review → approved/rejected.

## L13 — POPIA DSAR ⬜

Terminal: user submits DSAR → request processed → data export file generated + delivered.

## L14 — FICA/KYC ⬜

Terminal: tenant uploads ID + proof → owner reviews → owner approves → compliance.status=verified.

## L15 — Move-in inspection ⬜

Terminal: owner schedules → owner conducts → both parties sign → report.status=signed_both.

## L16 — Move-out inspection + damages ⬜

Terminal: owner schedules → conducts comparison vs move-in → damages flagged → deductions prepared.

## L17 — Vendor contract acceptance ⬜

Terminal: owner issues contract → vendor accepts → vendor_contracts.status=active.

## L18 — Vendor banking + payout ⬜

Terminal: vendor updates banking → payout schedule change persists → next payout runs.

## L19 — Property listing → discovery → view ⬜

Terminal: owner creates listing → tenant finds via search → tenant requests viewing (chains back to L04).

## L20 — Lala AI tool call (accept quote via AI) ⬜

Terminal: tenant/owner invokes Lala → AI calls accept_quote tool → quote.status=accepted via AI.

## L21 — Push notification delivery ⬜

Terminal: trigger event (quote submitted) → push lands on counterparty device → tap deep-links to right screen.

## L22 — Deposit interest accrual (cron) ⬜

Terminal: edge function runs → deposit_interest_accruals row inserted → tenant sees new balance.

## L23 — Property status machine ⬜

Terminal: property goes available → viewing-booked → application-received → holding-deposit-paid → leased, each transition verified in DB.

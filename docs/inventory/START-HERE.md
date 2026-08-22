# What LalaRente actually is (plain English)

You asked for one outcome: **know what the app has, what was promised but never finished, and what each kind of user can do.**

This file is that outcome. Open this first.

---

## The three users (plus admin on the web)

| Who        | Bottom tabs                                                   | What they are for                                              |
| ---------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| **Tenant** | Home, Search, Payments, Profile, Lala AI                      | Find a home, apply, pay, report problems, confirm work         |
| **Owner**  | Dashboard, Properties, Maintenance, Tenants, Profile, Lala AI | List units, pick tenants, collect rent, run repairs, paperwork |
| **Vendor** | Dashboard, Requests, Jobs, Earnings, Profile, Lala AI         | Quote jobs, do the work, get paid                              |
| **Admin**  | Separate website                                              | Users, properties, leases, payments, paying vendors            |

Many important screens are **not** on those tabs. They open from the dashboard, profile, or a card. That is why it feels like “too many steps.”

---

## What a tenant can do (screens that exist)

- Log in / register
- Home dashboard
- Search homes, open a listing, 3D tour
- Request a viewing, see viewing status
- Apply (4 steps: personal details, job, documents, review)
- See application status
- Lease, lease journey, renew, end early
- Pay rent
- Pay a vendor (plumber etc.) through Payments — not a 6th tab
- Deposit and holding deposit
- Late rent (arrears)
- Dispute a payment
- Report maintenance, track it, confirm the job is done (with photos)
- Inspections / reports (sign off, PDFs)
- Upload ID / documents
- Messages, notifications
- Privacy and “download my data”
- Lala AI chat

---

## What an owner can do (screens that exist)

- Dashboard (one big “do this next” button)
- Add / edit properties, photos, 3D link
- Applications: list, one application, compare applicants, holding deposit
- Create a lease, send it, PDF
- Tenants list
- Viewings
- Rent roll, invoices, monthly statements, tax reports
- Arrears, payment disputes, deposits, renewals, early termination
- Maintenance: create job, pick vendors, see quotes, send purchase order, timeline, approve closure, approve invoice, history per property
- Inspections: book, walk every room, photos, signatures, PDF
- Compliance: property certificates (upload works). Tenant FICA boxes **show** identity/credit/background but **do not run a real check**
- Insurance claims
- Documents hub (lots of shortcuts)
- Messages, notifications, privacy, Lala AI

---

## What a vendor can do (screens that exist)

- Dashboard
- Open requests → send / edit quote
- See purchase order
- My jobs → photo progress → ask to close → send invoice
- Contracts
- Earnings and bank details
- Services they offer, documents
- Messages, notifications, privacy, Lala AI

---

## The big journeys (how people actually use it)

**Get someone into a home**  
Search → viewing → apply → owner reviews → (credit/background **should** happen here) → holding deposit → lease → sign → move-in inspection.

**Collect rent**  
Owner invoice / rent roll → tenant Payments → PayFast. If late: arrears reminders. If fight: disputes.

**Fix something**  
Tenant reports → owner picks vendor → vendor quotes → owner accepts + PO → vendor works + photos → close job → tenant confirms → invoice → someone pays.

**Leave / renew**  
Renewals, early termination, move-out inspection, deposit refund (refund math exists in code but is **not hooked to the deposit screen**).

---

## What looks finished but is not (the important part)

These were planned. The screens still **look** like they work. They do not call a real company.

| You thought you had                                          | What is really there                                                                                                                                |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Background check + credit check before a lease**           | Badges on the application and FICA tab. Buttons/API only set status to “pending”. **No TPN / TransUnion / anyone.** Owner can still create a lease. |
| **ID verification (Onfido / Smile)**                         | Same: status only.                                                                                                                                  |
| **TPN RentCheck**                                            | Mentioned in an old 2026 write-up. Not in the app.                                                                                                  |
| **SigniFlow e-sign**                                         | People sign in the app with a drawing pad. Not SigniFlow.                                                                                           |
| **PayProp trust account**                                    | Not built.                                                                                                                                          |
| **Put listings on Property24**                               | Not built.                                                                                                                                          |
| **FICA “start identity / credit / background”**              | You can see “Not started”. You cannot start it.                                                                                                     |
| **Compare move-in vs move-out inspection to refund deposit** | Code exists. No screen uses it.                                                                                                                     |

PayFast **is** real now (rent and pay-vendor). An old document still says “no payment gateway” — that document is out of date.

Old detailed plans (`docs/flows/…`) were **deleted** from the project. That is why the team lost the thread.

---

## What this means for “too many taps” and Lala

The app is large on purpose: inspections alone are ~80 checklist items per visit. Cutting taps and letting Lala help only works **after** we decide, for each journey above:

- keep it as screens (but fewer steps), or
- let Lala draft/remind, with you confirming money, or
- **revive** a fake piece (screening) or **admit it is not a product yet**

Lala today only **talks**. It cannot run checks, quotes, or inspections.

---

## How we know (not just reading files)

Code can lie. We now overlay three things: files → wiring → **Maestro on the iPhone simulator**.

- **Ran just now:** `owner-screening-unwired` **passed**. Owner Compliance → FICA shows Identity, Credit, Background. There is **no** “Start check” / “Run check” on that screen. That is phone proof, not a comment in code.
- **Also ran:** owner Applications **list** passed. It does **not** open one application, so the screening badges on the application detail screen are still **unproven on the phone**.
- Coverage math (yaml vs routes): **55** screens Maestro even _mentions_, **75** screens have **no testID** so Maestro cannot aim at them, **10** have testIDs nobody uses. See `docs/inventory/generated/MAESTRO-COVERAGE.md`.
- Full suite is ~50 flows. That is **not** every screen. Missing screens between steps is exactly this gap.

The external code-graph tool (Gortex) is **not running** here. We still have a wiring list (`router.push` + who calls which function). Gortex would make that list stronger when it is back.

Do these in order. Do not start “fewer taps” or “Lala does chores” until 1–2 are decided — otherwise we polish a fake screening screen.

1. **Screening** — connect a real bureau **or** hide the badges. (Plane **#98**)
2. **Deposit after move-out** — inspection should drive the refund, or stop implying it is automatic. (**#100**)
3. **FICA tab** — Start buttons that run the same checks, or drop the empty circles. (**#101**)
4. **Lease auto-renew / rent increase** — code exists, nothing runs it. (**#102**)
5. **Then** fewer taps on the real journeys (apply, lease, maintenance, inspection).
6. **Then** Lala can remind/draft. It still must not pay money or fake a credit check.

Parent on Plane: **#99** Unfinished product — finish it or hide it. Mediation later: **#103**.

---

## If you only remember three things

1. **Screening before lease is fake.** That was a major requirement. It was never connected to a bureau.
2. **The rest of the rental loop is mostly real screens** — apply, lease, pay, maintenance, inspections, vendor pay — just long and split across many pages.
3. This file is the map. Plane **#98** is the first fix.

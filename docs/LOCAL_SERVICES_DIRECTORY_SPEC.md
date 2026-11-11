# Local Services Directory — Project Spec

**Status:** Draft v1
**Author:** Spec'd during 2026-10-21 session
**Working name:** Local Services Directory (final name TBD — see §14)

---

## 1. Vision & Why

Small South African service providers — Patricia Domestic Workers, Kimberly House of
Helpers, New Hope Domestic Helpers, and hundreds like them — currently rely on
printed flyers, WhatsApp forwards, and word of mouth to reach customers. They lack
a digital storefront and have no way to measure where their leads come from.

Lalarente already has thousands of landlords and tenants browsing the app for
property-related tasks. Those same users regularly need the exact services these
providers offer: nannies, cleaners, caregivers, gardeners, drivers, painters.

**The opportunity:** rent out directory space on our app to these providers in
exchange for commission, and build a proprietary **master lead-attribution dataset**
in the process. Providers manage their own customers off-platform; we own the
discovery layer and the data about who's hunting for what.

### Primary goals

1. **Monetization** — recurring revenue from listing fees + per-lead commission
2. **Master data** — every tap, call, WhatsApp open, and email tap becomes a row we own
3. **Stickiness** — gives tenants/owners another reason to return to the app
4. **Low-ops** — providers run their own customer relationships; we don't take bookings

### What this is NOT (explicit non-goals)

- ❌ **Not an in-app booking system.** We do not take appointments, calendar their
  availability, or hold their customers' contact info in-app.
- ❌ **Not an in-app payment flow.** Providers invoice their customers directly, by
  cash, EFT, SnapScan, whatever they currently use. We only invoice _them_ for the
  ad space.
- ❌ **Not integrated with the existing vendor-maintenance (PO) workflow.** Those
  vendors do contracted maintenance jobs via owners' POs. Local Services providers
  do open-market services for consumers. Keep the two completely separate — same
  app, different features, different data models.
- ❌ **Not self-serve for providers (v1).** Admin creates/edits listings on their
  behalf, invoices them manually. Self-serve is a later version.
- ❌ **Not a review/rating system (v1).** Reviews bring moderation + defamation
  risk. Launch without; add later if demand is clear.

---

## 2. Personas

| Persona                                            | Role       | What they do here                                                                                               |
| -------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| **Consumer** (tenant, owner, or anonymous visitor) | Browse     | Looks for a nanny / cleaner / gardener; taps a listing; calls or WhatsApps the provider.                        |
| **Provider** (Patricia, Kimberly, New Hope, etc.)  | Advertiser | Pays for a listing slot; receives leads via phone/WhatsApp directly. Does NOT log into the app.                 |
| **Admin** (Lalarente staff)                        | Operator   | Onboards new providers, creates/edits their listings, approves content, invoices them, pulls analytics reports. |

---

## 3. User journeys

### 3.1 Consumer journey (happy path)

```
Open app → tap "Local Services" tab (new, bottom nav)
  → see categories grid (Nannies, Cleaners, Caregivers, Gardeners, ...)
  → tap "Nannies" → see list of nanny listings in their area
  → tap a listing card → listing detail (photos, areas served, services, contact buttons)
  → tap "Call" OR "WhatsApp" OR "Email"
  → system logs the event, launches native dialer / WhatsApp / mail app
  → consumer talks to provider directly off-app
```

**Logged events along the way:** `impression` (list view), `view`
(detail view), `tap_call`, `tap_whatsapp`, `tap_email`, `tap_website`.

### 3.2 Provider journey (v1 — no app login)

```
Provider contacts Lalarente (phone / WhatsApp / email, inbound from flyers or outbound sales)
  → Admin collects: name, logo, contact numbers, service list, areas served, pricing tier
  → Admin creates listing in admin panel (web, or admin-only screens in app)
  → Admin assigns tier (free / featured / premium) + expiry
  → Listing goes live
  → Monthly: admin pulls analytics, invoices provider via Yoco/EFT (off-platform)
  → Provider renews, upgrades, or churns
```

### 3.3 Admin journey

```
Admin login → "Local Services Admin" screen
  → Create new listing (form: name, logo upload, contact methods, categories, areas, tier, expiry)
  → Approve pending edits
  → Dashboard: active listings, impressions this month, lead events this month, revenue
  → Export CSV for invoicing / BI
```

---

## 4. Data model

New tables, all in `public.` schema. Zero changes to existing tables.

### 4.1 `service_listings` — the ad itself

```sql
CREATE TABLE service_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable provider identity across pricing periods. The first listing for a
  -- provider sets canonical_listing_id = id (self-referential, same UUID).
  -- Every renewal row points back to that first listing. NOT NULL because
  -- every row must carry its identity anchor; the admin UI must supply both
  -- id and canonical_listing_id in the same INSERT statement (see §4.1 notes).
  -- A trigger enforces that canonical_listing_id references a row where
  -- canonical_listing_id = id (i.e. a true original, not a renewal).
  -- Query `WHERE canonical_listing_id = X` to retrieve the full history of
  -- a provider regardless of pricing period.
  canonical_listing_id UUID NOT NULL REFERENCES service_listings(id) ON DELETE RESTRICT,
  business_name TEXT NOT NULL,
  tagline TEXT,                          -- "Trusted People. Better Homes."
  description TEXT,                      -- long-form "about us"
  logo_url TEXT,                         -- Supabase Storage
  hero_image_url TEXT,                   -- the full flyer image if provided
  primary_phone TEXT NOT NULL,
  whatsapp_number TEXT,                  -- can equal primary_phone
  email TEXT,
  website_url TEXT,
  categories TEXT[] NOT NULL,            -- ['nannies', 'cleaners', 'elderly_care']
  areas_served TEXT[] NOT NULL,          -- ['Umhlanga', 'Durban North', 'Pinetown']
  tier TEXT NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'featured', 'premium')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'paused', 'expired', 'rejected', 'archived')),
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,       -- renewal deadline
  deleted_at TIMESTAMPTZ,               -- soft-delete; listing is NEVER hard-deleted
  monthly_fee_cents INT NOT NULL DEFAULT 0 CHECK (monthly_fee_cents >= 0),    -- what we charge them
  per_lead_fee_cents INT NOT NULL DEFAULT 0 CHECK (per_lead_fee_cents >= 0), -- commission per contact tap
  -- Rate fields are locked by a trigger once status transitions to 'active'.
  -- A new listing row (new UUID, new starts_at/expires_at) is used for each
  -- pricing period. Events reference the listing ID whose rates were agreed at
  -- the time events were generated. Invoices reference the same listing ID and
  -- snapshot the rates at billing time, ensuring each period's events and
  -- invoice are always billed at the rates agreed for that specific listing row.
  -- This design means mid-period price changes require admin to create a new
  -- listing (renewal row) and expire the old one, never an UPDATE to rate columns.
  -- The canonical_listing_id on the renewal row links it to the original provider.
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- admin who created it; NULL after account deletion
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_listings_status_tier
  ON service_listings(status, tier) WHERE status = 'active';
CREATE INDEX idx_service_listings_categories
  ON service_listings USING GIN(categories);
CREATE INDEX idx_service_listings_areas
  ON service_listings USING GIN(areas_served);
-- Provider history: query all periods for a provider by their first listing's id.
CREATE INDEX idx_service_listings_canonical
  ON service_listings(canonical_listing_id);
```

**Provider identity and renewal lifecycle:**

A provider has a stable identity anchored to their first (original) listing row:

- When admin creates the **first listing** for a provider, the admin UI sends a single INSERT with both `id` and `canonical_listing_id` set to the same pre-generated UUID. The `NOT NULL` constraint requires this — a separate UPDATE-after-INSERT is not viable.
- A BEFORE INSERT trigger enforces the canonical identity rule with two branches:
  1. **Self-reference (original):** if `NEW.canonical_listing_id = NEW.id`, the row is its own original — no DB query required; pass through.
  2. **Renewal:** if `NEW.canonical_listing_id ≠ NEW.id`, query to verify `canonical_listing_id` references an existing row where `canonical_listing_id = id` (a true original). Reject if the target is itself a renewal — this prevents `R → A` where A is already `R' → A'`.
- `canonical_listing_id` is **immutable after insertion for every row** (originals and renewals alike). A BEFORE UPDATE trigger rejects any attempt to change it. This applies to originals too — if original A could be updated to point to B, all existing renewals would retain `canonical_listing_id = A` while A now has `canonical_listing_id = B`, silently creating a chain (`R → A → B`) that breaks `WHERE canonical_listing_id = X` queries.
- **Chain prevention is guaranteed by the two triggers working together:**
  - INSERT trigger (branch 2) blocks a new row from pointing at a renewal — no chain can be created on INSERT.
  - UPDATE trigger blocks mutating `canonical_listing_id` on any existing row — no chain can be created by later modification.
  - Together these two invariants make it impossible to construct a chain at any point in the row's lifetime.
- When a **pricing period ends** and admin renews/changes tier, they INSERT a new listing row with the new `starts_at`/`expires_at`/rate fields and set `canonical_listing_id = <original listing's id>`.
- All event analytics, provider history, and cross-period reporting query `WHERE canonical_listing_id = <original id>` — `business_name_snapshot` on events is for display only and cannot be used as a join key.
- `ON DELETE RESTRICT` is a safety net but originals are **never hard-deleted** under the platform's soft-delete-only policy (`deleted_at + status='archived'`). Archiving a row does not remove its foreign key reference, so `ON DELETE RESTRICT` is never triggered in normal operation.

**Trigger acceptance cases (INSERT trigger):**

| Scenario                                 | `canonical_listing_id`                 | Expected                                                |
| ---------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| Initial creation                         | `= NEW.id` (self-reference)            | ✅ Pass — no DB query, branch 1                         |
| Valid renewal                            | `= <id of an existing original>`       | ✅ Pass — branch 2 query confirms target is an original |
| Renewal → renewal                        | `= <id of a row where canonical ≠ id>` | ❌ Rejected — target is itself a renewal                |
| Attempt to update `canonical_listing_id` | any UPDATE                             | ❌ Rejected — immutability trigger fires                |

### 4.2 `listing_events` — the master data

```sql
CREATE TABLE listing_events (
  id BIGSERIAL PRIMARY KEY,              -- high volume, bigserial not uuid
  listing_id UUID NOT NULL REFERENCES service_listings(id) ON DELETE RESTRICT,
  -- NOT NULL: every event must be attributable to a specific listing and its
  -- agreed billing rates. An unlinked event cannot be billed or analyzed.
  -- ON DELETE RESTRICT is a safety net; listings are never hard-deleted
  -- (soft-delete only via deleted_at + status='archived').
  business_name_snapshot TEXT NOT NULL,  -- denormalized at event time; survives listing archival
  idempotency_key UUID UNIQUE,           -- client-generated; the inline UNIQUE constraint is the
                                         -- conflict target for INSERT...ON CONFLICT DO NOTHING
                                         -- (see §8.2 deduplication contract)
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'impression',   -- card shown in a list
      'view',         -- detail screen opened
      'tap_call',     -- phone CTA tapped
      'tap_whatsapp', -- whatsapp CTA tapped
      'tap_email',    -- email CTA tapped
      'tap_website',  -- website CTA tapped
      'share'         -- shared to another app
    )),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- NULL = anonymous visitor or deleted user
  user_role TEXT,                          -- cached role at event time
  session_id UUID,                         -- client-generated per app session
  area_filter TEXT,                        -- what area filter was active
  category_filter TEXT,                    -- what category filter was active
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: no separate CREATE UNIQUE INDEX for idempotency_key — the inline
-- UNIQUE constraint on the column already creates a full unique index,
-- which PostgreSQL uses as the conflict target for ON CONFLICT (idempotency_key).
-- A redundant partial index on the same column would waste write overhead.

CREATE INDEX idx_listing_events_listing_time
  ON listing_events(listing_id, created_at DESC);
CREATE INDEX idx_listing_events_type_time
  ON listing_events(event_type, created_at DESC);
CREATE INDEX idx_listing_events_user_time
  ON listing_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
```

**Idempotency contract** (atomic deduplication):

- Client generates a UUID4 `idempotency_key` per intent (once per CTA tap, persisted in memory for the session).
- Edge function uses `INSERT INTO listing_events (...) ON CONFLICT (idempotency_key) DO NOTHING`.
- The unique constraint makes this conflict detection atomic; concurrent retries cannot both succeed.
- A fresh key is required for each new intent — the same key on a retry of the same tap does nothing (correct); a new tap generates a new key.
- The 1-hour window deduplication from §4.5 is a secondary defence against clients that never send an `idempotency_key`.

### 4.3 `service_listing_categories` — admin-managed category seed

```sql
CREATE TABLE service_listing_categories (
  slug TEXT PRIMARY KEY,                  -- 'nannies'
  display_name TEXT NOT NULL,             -- 'Nannies & Childcare'
  icon TEXT,                              -- Ionicons name
  sort_order INT DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE
);
```

Seed with: nannies, housekeepers, cleaners, caregivers, elderly_care, child_care,
drivers, gardeners, cooks, teachers, petcare, builders, painters, plumbers,
electricians, home_management, maintenance_general.

### 4.4 `service_listing_invoices` — our billing records (optional v1, required v2)

```sql
CREATE TABLE service_listing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES service_listings(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  monthly_fee_cents INT NOT NULL,
  lead_count INT NOT NULL,
  lead_fee_cents INT NOT NULL,
  total_cents INT NOT NULL,
  -- Rates are snapshotted from service_listings at billing time so a future
  -- price change on the listing does not retroactively alter issued invoices.
  per_lead_fee_cents_snapshot INT NOT NULL DEFAULT 0,
  status TEXT CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'written_off')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.5 RLS policies

- **`service_listings`**
  - Base table grants: `REVOKE ALL ON service_listings FROM anon, authenticated` — no direct
    table access for consumers; prevents column-level bypass of the view restriction.
  - **Consumer access via view only** (`SECURITY INVOKER` — caller's RLS applies, no owner bypass):
    ```sql
    CREATE VIEW service_listings_public SECURITY INVOKER AS
      SELECT id, business_name, tagline, description, logo_url, hero_image_url,
             primary_phone, whatsapp_number, email, website_url,
             categories, areas_served, tier
        FROM service_listings
       WHERE status = 'active'
         AND starts_at <= NOW()
         AND expires_at > NOW()
         AND deleted_at IS NULL;
    GRANT SELECT ON service_listings_public TO anon, authenticated;
    ```
    `monthly_fee_cents`, `per_lead_fee_cents`, and `created_by` are not projected and
    cannot be queried by non-admins even via direct column reference on the base table.
  - SELECT (admins): full table access via policy `USING (auth.jwt() ->> 'role' IN ('admin', 'superadmin'))`.
  - INSERT/UPDATE: admin or superadmin JWT role only.
  - DELETE: blocked entirely; admin archives via `deleted_at = NOW(), status = 'archived'`.
- **`listing_events`**
  - INSERT: **not exposed via RLS**. All writes go through the `log-listing-event` edge function
    (service role, §8.2). The function:
    1. Sets `user_id`, `user_role`, `created_at`, and `business_name_snapshot` server-side.
    2. Uses `INSERT INTO listing_events (...) ON CONFLICT (idempotency_key) DO NOTHING`
       — the `UNIQUE` constraint on `idempotency_key` makes this atomic; concurrent
       retries cannot both succeed. Anonymous events use `(listing_id, session_id, event_type)`
       window deduplication as a secondary defence when no idempotency key is supplied.
  - SELECT: admin / superadmin only (prevents competitors from scraping our data).
- **`service_listing_invoices`**
  - All: admin / superadmin only.

---

## 5. UI surface

### 5.1 New bottom-nav tab: "Local Services"

Appears for all roles (tenant, owner, vendor). Replaces nothing — becomes 6th tab,
or we promote it as prominent CTA on dashboards if 6 tabs feels crowded (decide
during design).

### 5.2 Screens (new)

| Path                                                                    | Purpose                                                             | TestID prefix                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `/(tenant)/services` <br> `/(owner)/services` <br> `/(vendor)/services` | **Categories grid** — tap a category to filter                      | `services-category-*`                                              |
| `/(role)/services/list`                                                 | **Listings list** — filter by category + area, shows featured first | `services-listing-card`                                            |
| `/(role)/services/[id]`                                                 | **Listing detail** — photos, services, contact CTAs                 | `services-tap-call`, `services-tap-whatsapp`, `services-tap-email` |
| `/(role)/services/search`                                               | **Search by text + area**                                           | `services-search`                                                  |

### 5.3 Admin-only screens

| Path                                        | Purpose                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `/(superadmin)/services/listings`           | Table of all listings with status, tier, expiry, monthly leads                     |
| `/(superadmin)/services/listings/new`       | Create listing form (name, logo upload, contacts, categories, areas, tier, expiry) |
| `/(superadmin)/services/listings/[id]/edit` | Edit any field                                                                     |
| `/(superadmin)/services/analytics`          | Per-listing dashboards: impressions / views / taps / lead-conversion funnel        |
| `/(superadmin)/services/invoices`           | Generated monthly invoices, mark paid                                              |

### 5.4 Reused infrastructure

- **Storage** — `service-listing-assets` bucket (logos, hero images), public read
- **Auth** — existing superadmin role gate for admin screens
- **Supabase Edge Functions** — one new fn `log-listing-event` for high-throughput
  event ingestion (bypasses RLS, uses service role)

---

## 6. Analytics / master data

The whole point of this project. Three dashboards:

### 6.1 Per-listing (shown to admin, exportable to provider)

- Impressions (list card shown)
- Detail views
- Tap-through rate (views → any tap)
- Breakdown by channel: call / whatsapp / email
- Daily / weekly / monthly trend lines
- Top areas where consumers tap from
- Top times of day

### 6.2 Platform-wide (admin only)

- Total active listings per tier
- Total events per month, YoY growth
- Revenue (monthly fees + per-lead) per month
- Category heatmap: which categories get the most leads
- Area heatmap: which SA cities drive the most leads
- Repeat-tap users (same user tapping multiple listings in same category = underserved demand signal)

### 6.3 Master lead dataset (the moat)

Over time this becomes the single best SA dataset of "what domestic services do
tenants in Umhlanga search for at what times." Future monetization: aggregated
reports sold to franchise groups, insurance partners, government labour studies.

---

## 7. Monetization model

### 7.1 Tier structure (v1 — simple, iterate)

| Tier         | Monthly fee | Per-lead fee | Visibility                                                                                                  |
| ------------ | ----------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| **Free**     | R0          | R0           | Listed at bottom of area, no featured badge, no hero image                                                  |
| **Featured** | R299        | R0           | Top of category/area list, featured badge, 1 hero image                                                     |
| **Premium**  | R799        | R0           | #1 slot in area, "sponsored" badge, 5 hero images + description, phone-call attribution preview to provider |

Per-lead fees deferred to v2 — v1 is flat monthly to simplify billing.

### 7.2 Billing

v1: admin generates invoice PDF monthly, emails to provider, provider pays via
EFT or SnapScan off-platform. Admin marks `service_listing_invoices.status = 'paid'`.

v2: Yoco/PayFast integration for provider self-service billing.

---

## 8. Technical implementation

### 8.1 Codebase placement

```
app/
  (tenant)/services/
    index.tsx           → categories grid
    list.tsx            → filtered list
    [id].tsx            → detail
    search.tsx
  (owner)/services/     → re-exports (same screens, owner tab context)
  (vendor)/services/    → re-exports

src/
  features/
    services-directory/          ← NEW feature folder
      api/
        listingsApi.ts
        eventsApi.ts
      screens/
        ServicesCategoriesScreen.tsx
        ServicesListScreen.tsx
        ServicesDetailScreen.tsx
        ServicesSearchScreen.tsx
        admin/
          AdminListingsScreen.tsx
          AdminListingFormScreen.tsx
          AdminAnalyticsScreen.tsx
          AdminInvoicesScreen.tsx
      components/
        ListingCard.tsx
        ListingContactButtons.tsx    ← emits events on tap
      hooks/
        useListingEventLogger.ts
      types/
        serviceListings.types.ts

supabase/
  functions/
    log-listing-event/              ← NEW edge fn
      index.ts
  migrations/
    20261022000001_service_listings.sql
    20261022000002_listing_events.sql
    20261022000003_service_listing_categories_seed.sql
```

### 8.2 Event logging implementation

Client calls edge function (not direct insert) to:

1. Set `user_id`, `user_role`, `created_at`, and `business_name_snapshot` from the
   verified JWT / server clock — clients cannot fabricate identity.
2. **Deduplicate billable taps** — `tap_call`, `tap_whatsapp`, `tap_email` are idempotent
   within a 1-hour window per `(listing_id, user_id/session_id, event_type)` via
   `idempotency_key`. A retry or accidental double-tap does not create a duplicate
   billable event.
3. Bypass RLS cleanly (service role key never sent to client).
4. Rate-limit abusive clients centrally (IP + session).
5. Buffer / batch if needed (v2).

```ts
// src/features/services-directory/hooks/useListingEventLogger.ts
export function useListingEventLogger() {
  const { user, profile } = useAuth();
  return async (
    listingId: string,
    eventType: ListingEventType,
    filters?: { area?: string; category?: string }
  ) => {
    await fetch(`${SUPABASE_URL}/functions/v1/log-listing-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({
        listing_id: listingId,
        event_type: eventType,
        user_id: user?.id ?? null,
        user_role: profile?.role ?? null,
        session_id: getSessionId(), // AsyncStorage-persisted per app session
        area_filter: filters?.area ?? null,
        category_filter: filters?.category ?? null,
      }),
    }).catch(() => {}); // Fire-and-forget; never block the user's intent
  };
}
```

### 8.3 Contact button behaviour

```ts
// ListingContactButtons.tsx
const logEvent = useListingEventLogger();
const handleCall = () => {
  logEvent(listing.id, 'tap_call');
  Linking.openURL(`tel:${listing.primary_phone}`);
};
const handleWhatsApp = () => {
  logEvent(listing.id, 'tap_whatsapp');
  const n = listing.whatsapp_number || listing.primary_phone;
  Linking.openURL(`https://wa.me/${n.replace(/\D/g, '')}`);
};
```

**Critical:** event logging is fire-and-forget; never await it before `Linking.openURL`.
A dropped event is fine; a delayed phone call is a product failure.

### 8.4 Native linking

- iOS Info.plist: already has `tel`, `mailto`, `https` schemes. Need to add
  `whatsapp` and `wa` to `LSApplicationQueriesSchemes` for `canOpenURL` checks.
- Android Manifest: add `<queries>` entries for `tel`, `mailto`, `https`.

---

## 9. Phasing

### v1 — MVP (ships to beta providers after 2-3 weeks of focused work)

- 4 consumer screens (categories grid, list, detail, search)
- 4 admin screens (listings table, create, edit, analytics)
- All 4 tables + edge fn + migrations
- Tier field exists but all v1 listings default to `featured` (flat R299/month)
- Manual invoicing by admin
- No reviews, no self-serve, no in-app payment to providers

### v2 — Monetization + scale (6-8 weeks after v1)

- Per-lead billing option
- Yoco/PayFast integration for providers to pay listing fees
- Provider portal (web first, maybe just a Vercel React page with magic-link auth to Supabase)
- CSV export for consumer-side category analytics
- Email digest to admin: "weekly listings performance report"
- Push notification to tenant when a new listing appears in their area

### v3 — Trust layer (3-6 months after v2)

- Reviews + ratings (moderated)
- FICA document upload for providers (optional "verified" badge)
- Dispute resolution flow
- Public API for third-party integration

---

## 10. Legal / compliance

| Risk                                                                                                                | Mitigation                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **POPIA** — logging user_id against listing taps is personal data processing                                        | Add explicit consent toggle in app settings. Default: anonymised (session_id only, user_id null). Opt-in to help providers see "who viewed".                    |
| **Consumer Protection Act** — if we imply we vetted providers, we're liable for bad actors                          | Explicit disclaimer on every listing: "Lalarente does not verify, employ, or vet these providers. Transact at your own discretion." Keep it legally defensible. |
| **FICA** — advertising to employ domestic workers triggers Basic Conditions of Employment Act awareness obligations | Boilerplate link to "Your responsibilities as an employer" on first use of a listing per user.                                                                  |
| **Defamation** — provider could sue over bad review                                                                 | v1 has no reviews. v3 adds strict moderation + takedown SLA.                                                                                                    |
| **False advertising** — provider claims a service they don't deliver                                                | Admin manually reviews every v1 listing before activation. v2 adds terms-of-service that reserves the right to delist.                                          |

---

## 11. Metrics for success

### 90-day goals post-v1 launch

- 25 active listings (featured tier)
- R7,500 MRR (25 × R299)
- 5,000 listing impressions / month
- 500 contact taps / month
- 10% tap-through rate on detail views
- NPS >40 among consumers who tap

### 12-month north-star

- 500 active listings
- R150k MRR
- Local Services tab = 2nd most-visited after Dashboard for tenants

---

## 12. Risks & open questions

### Risks

1. **Low initial supply.** We launch with 3 providers (Patricia, Kimberly, New Hope), consumers tap once and never return because empty. → Mitigation: outbound sales to seed 20 before public launch.
2. **Low initial demand.** Providers sign up but no consumers tap. → Mitigation: push a notification to all tenants on launch; feature prominently on dashboard for 30 days.
3. **Lead fraud.** Providers tap their own listings to inflate stats. → Mitigation: dedupe events by user_id + listing_id + hour; flag suspicious patterns in admin dashboard.
4. **Scope creep into bookings.** Consumers will ask for in-app booking. → Mitigation: product discipline — hold the line on §1 non-goals until v3.

### Open questions

1. **Branding** — is "Local Services" the right name? Alternatives: "Neighbourhood Services", "Lalarente Marketplace", "Help at Home".
2. **Tab vs. dashboard shortcut** — 6th bottom-nav tab, or just a prominent dashboard card? Depends on UX test.
3. **Admin surface in-app or web?** — Fastest to ship: superadmin screens in the existing React Native app. Longer-term: a Vercel admin dashboard.
4. **Pricing** — R299/month a guess. Validate with 3 pilot providers before locking.
5. **Who owns provider relationships?** — Dedicated sales rep, or admin wears all hats? Affects headcount plan.
6. **Geographic scope** — v1 Durban only (where current providers are), expand to Cape Town / JHB as supply grows?

---

## 13. Rough estimate

| Milestone                                 | Effort (sr. dev weeks) |
| ----------------------------------------- | ---------------------- |
| Migrations + edge fn + tests              | 1                      |
| Consumer screens (4 screens + components) | 2                      |
| Admin screens (4 screens)                 | 2                      |
| Event logging + analytics queries         | 1                      |
| Visual design + copy polish               | 1                      |
| QA + beta launch with 3 pilot providers   | 1                      |
| **v1 total**                              | **~8 weeks**           |

Compressible to 4-5 weeks with two devs in parallel (one on consumer, one on admin).

---

## 14. Decision log for approval

Items that need your (Arsalan) sign-off before implementation starts:

- [ ] **Project greenlit** or deferred to a specific quarter
- [ ] **Final name** for the feature
- [ ] **Tier pricing** (R299/R799 or your numbers)
- [ ] **Launch city** (Durban-only or wider)
- [ ] **Who sells** (dedicated rep vs. you handling the first 20 providers)
- [ ] **Legal review** of consumer disclaimer copy
- [ ] **Design pass** by someone with taste before build starts
- [ ] **Pilot providers confirmed** (minimum 3 signed before dev starts, 20 before public launch)

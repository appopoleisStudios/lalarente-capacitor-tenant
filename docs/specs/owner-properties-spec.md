# Owner Properties – Specification (DB‑first, Mobile‑first)

Reference inspiration: Kites Design Property app layouts (for visual flow only) – see [design reference](https://kites.design/apps/property-buy-and-sell-app-design). Keep Lala Rente owner branding (blue theme, rounded cards, soft shadows) and UX patterns consistent with existing app.

---

## 1. Goals
- Allow owners to add, view, edit, and manage properties for rent.
- Mobile‑first UX, image upload via Capacitor to Supabase Storage with progress.
- DB‑first: strictly align to existing `public.properties` schema and RLS.
- Easy search/filter/sort and clean property cards.

## 2. User Flows

### 2.1 Create Property (Stepper)
1) Basics: title, description, address (address, city, state, postal_code, country)
2) Details: bedrooms, bathrooms, size_sqft, property_type, furnished, amenities[]
3) Pricing & Status: rent_amount, deposit_amount, status (available/occupied/inactive), available_from
4) Photos: capture/upload, preview, reorder, delete
5) Review & Save → insert row → upload photos to Storage path by property_id

### 2.2 Manage Properties
- List: search, filters (status, city, type), sort (newest, rent).
- Detail: summary, badges, gallery, actions (Edit, Add Photos, Archive).
- Edit: same sections as Create; incremental save.

## 3. Routes (Owner)
- `src/app/dashboard/owner/properties/page.tsx` – list/search/filter/sort; floating “Add Property”.
- `src/app/dashboard/owner/properties/new/page.tsx` – stepper form; sticky Next/Save; upload progress.
- `src/app/dashboard/owner/properties/[id]/edit/page.tsx` – tabs: Details | Photos; delete/reorder images.

## 4. UI Components
- `PropertyCard` – title, address line, badges (status, beds/baths, size), rent/month, thumbnails, menu.
- `PropertyForm` – controlled inputs with validation; steppers.
- `PhotoGrid` – responsive grid with preview, delete, reorder.
- `UploadProgressBar` – per‑file progress and overall progress.

Branding: owner blue palette; rounded corners; subtle shadows; readable dark text (`text-gray-900`).

## 5. Database Schema (aligned to current types)

Table `public.properties` (per `src/types/supabase.ts`):
- `id` uuid PK
- `owner_id` uuid NOT NULL REFERENCES `profiles(id)`
- `title` text NOT NULL
- `description` text NULL
- `address` text NOT NULL
- `city` text NOT NULL
- `province` text NOT NULL
- `postal_code` text NULL
- `property_type` text NOT NULL
- `bedrooms` int NULL
- `bathrooms` int NULL
- `parking_spaces` int NULL
- `amenities` text[] NULL
- `images` text[] NULL
- `lease_terms` jsonb NULL
- `assigned_vendor_id` uuid NULL REFERENCES `profiles(id)`
- `rent_amount` numeric NOT NULL
- `deposit_amount` numeric NULL
- `status` public.property_status NULL (enum: 'available' | 'occupied' | 'maintenance' | 'vacant')
- `created_at` timestamptz NULL DEFAULT now()
- `updated_at` timestamptz NULL DEFAULT now()

Indexes (recommended):
- on `(owner_id)`
- on `(status)`
- on `(created_at DESC)`

No DB change proposed at this time; UI must follow this schema. Any future DB changes require migration + RLS review + development-log entry.

## 6. RLS Policies (expected)
- Enable RLS on `public.properties`.
- INSERT: `owner_id = auth.uid()`
- SELECT/UPDATE/DELETE: `owner_id = auth.uid()`

Storage buckets:
- `property-images/{owner_id}/{property_id}/{uuid}.jpg`
  - Read: allow if path owner_id == auth.uid()
  - Write: allow if path owner_id == auth.uid()

## 7. Types & Validation

TypeScript (`src/types/supabase.ts`): ensure `Database['public']['Tables']['properties']['Row']` matches actual DB.

Client validation rules:
- Required: title, address, city, province, property_type, rent_amount ≥ 0
- Optional: bedrooms, bathrooms, parking_spaces, deposit_amount, postal_code, amenities[], images[]

## 8. Client/Data Layer Contracts

Helper APIs in `src/lib/supabase.ts`:
- `async function createProperty(input: CreatePropertyInput): Promise<{ id: string }>`
  - Inserts row with `owner_id = auth.uid()`.
- `async function updateProperty(id: string, input: UpdatePropertyInput): Promise<void>`
- `async function uploadPropertyImages(propertyId: string, files: FileLike[]): Promise<{ paths: string[] }>`
  - Converts Capacitor file URIs to Blobs; uploads to Storage; returns object paths.

Store (`src/store/propertyStore.ts`):
- Extend with `createProperty`, `updateProperty`, `uploadImages`; optimistic updates; error state.

## 9. API Call Shapes (Supabase)

Insert:
```ts
const { data, error } = await supabase
  .from('properties')
  .insert({
    owner_id: user.id,
    title, description,
    address, city, province, postal_code,
    bedrooms, bathrooms, parking_spaces, property_type, amenities,
    rent_amount, deposit_amount, status
  })
  .select('id')
  .maybeSingle()
```

Update:
```ts
const { error } = await supabase
  .from('properties')
  .update({ /* fields */ })
  .eq('id', propertyId)
```

List (owner):
```ts
const { data } = await supabase
  .from('properties')
  .select('id, title, address, city, province, bedrooms, bathrooms, rent_amount, status, created_at, images')
  .eq('owner_id', user.id)
  .order('created_at', { ascending: false })
```

Storage upload path:
```
property-images/${user.id}/${propertyId}/${cryptoUuid}.jpg
```

## 10. UI Details
- Search: matches title/address/city.
- Filters: status, city, property_type.
- Sort: newest, rent high→low / low→high.
- Cards: show rent/month, beds/baths, size, status pill, small thumbnail stack.
- Forms: mobile stepper, sticky actions, inline errors, `data-testid` hooks.

## 11. Mobile Image Capture
- Capacitor Camera → Filesystem → Blob conversion.
- Compress before upload; limit images (e.g., 12), size; show progress/cancel.

## 12. QA & Testing
- Playwright (web): create/edit/list; filters/sort; RLS denial for non‑owner.
- Appium (mobile): capture photo and upload; gallery renders; edit on device.
- Add `data-testid` for all critical actions.
- Checklist: edge cases (missing required fields, network failures, upload cancel/retry, large images).

## 13. Rollback/Recovery Notes
- If UI regression/confusion:
  - Revert to route skeletons listed in §3.
  - Use API call shapes in §9 to verify minimal flows.
  - Validate RLS (§6) and types (§7) to resolve runtime errors.
- If storage/imagery breaks:
  - Disable photos tab; keep metadata CRUD; restore uploads after Storage policy check.

## 14. Open Items
- Verify actual `properties` schema & RLS in Supabase and reconcile field names/types.
- Confirm Storage buckets/policies exist; add if missing.

Document owner: Engineering
Last updated: YYYY‑MM‑DD



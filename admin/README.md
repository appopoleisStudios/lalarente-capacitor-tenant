# LaLarente Admin Panel

Web-based admin dashboard for the LaLarente property management platform.

Built with **React + Vite + TypeScript + Tailwind v4**.

## Architecture

- **Supabase RPC functions** (SECURITY DEFINER) bypass RLS for admin data access
- **Auth gating** — only users with `role = 'admin'` can access
- **Two role tiers:** Superadmin (business ops) and Dev Admin (+ dev tools)
- **All data queries** go through `src/hooks/useAdminData.ts` → Supabase RPCs

## Pages

| Route | Access | Purpose |
|-------|--------|---------|
| `/` | Both | Dashboard with 8 KPI cards |
| `/users` | Both | List users, toggle dev admin |
| `/properties` | Both | Property inventory |
| `/leases` | Both | Lease overview |
| `/maintenance` | Both | Maintenance requests |
| `/payments` | Both | Financial metrics |
| `/dev/plane` | Dev only | Plane.so issue CRUD |
| `/dev/logs` | Dev only | Edge function execution logs |
| `/dev/audit` | Dev only | Unified audit trail |
| `/dev/env` | Dev only | Environment variable viewer |

## Key Files

```
admin/
├── src/
│   ├── components/
│   │   ├── DataTable.tsx       # Reusable typed table
│   │   ├── Sidebar.tsx         # Role-aware nav sidebar
│   │   ├── Layout.tsx          # Main layout wrapper
│   │   └── AuthGate.tsx        # Route protection
│   ├── hooks/
│   │   ├── useAuth.ts          # Supabase auth + role gate
│   │   └── useAdminData.ts     # Generic RPC data fetcher
│   ├── pages/                  # Route page components
│   ├── lib/
│   │   ├── supabaseClient.ts   # Supabase client
│   │   └── planeApi.ts         # Plane REST API client
│   ├── types/admin.ts          # Shared TypeScript interfaces
│   └── test/setup.ts           # Vitest setup
├── database/migrations/
│   ├── 038_add_admin_dev_flag.sql
│   ├── 039_admin_panel_functions.sql
│   ├── 040_dev_function_logs.sql
│   └── 041_admin_audit_trail.sql
├── DEPLOY.md                   # Vercel deployment guide
└── vercel.json                 # Vercel configuration
```

## Setup

```bash
cd admin
cp .env.example .env   # Fill in Supabase + Plane credentials
npm install
npm run dev            # http://localhost:5173
```

## Tests

```bash
cd admin
npm test               # 12 tests (DataTable + useAdminData)
```

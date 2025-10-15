# Lalarente Feature Architecture

## 🎯 Design Pattern: Role-Based + Domain-Driven

### Role Features (UI + User Experience)
These contain **screens, components, and navigation** specific to each user role.

#### `owner/` - Property Owner Role
- Screens: Dashboard, Add Property, Manage Tenants, View Reports
- Components: PropertyCard, TenantCard, AnalyticsWidget
- Hooks: useOwnerDashboard, usePropertyStats

#### `tenant/` - Tenant Role  
- Screens: Dashboard, Browse Properties, My Lease, Pay Rent
- Components: PropertySearchCard, LeaseDetails, PaymentCard
- Hooks: useTenantDashboard, useMyLease

#### `vendor/` - Service Provider Role
- Screens: Dashboard, Job Requests, Completed Jobs
- Components: JobCard, VendorProfile
- Hooks: useVendorDashboard, useJobRequests

---

### Domain Features (Business Logic)
These contain **API, hooks, and types** shared across roles. **NO SCREENS.**

#### `properties/` - Property Management Domain
- API: CRUD operations (create, read, update, delete properties)
- Hooks: useProperties, useProperty
- Types: Property, PropertyFilters

#### `leases/` - Lease Management Domain
- API: Lease lifecycle (create, renew, terminate)
- Hooks: useLeases, useLease
- Types: Lease, LeaseStatus

#### `payments/` - Payment Processing Domain
- API: Process rent, vendor payments, refunds
- Hooks: usePayments, usePaymentHistory
- Types: Payment, PaymentStatus

#### `maintenance/` - Maintenance Tickets Domain
- API: Create tickets, assign vendors, track status
- Hooks: useTickets, useTicket
- Types: Ticket, TicketStatus

#### `messaging/` - Chat System Domain
- API: Send messages, upload files, typing indicators
- Hooks: useConversations, useMessages
- Components: ChatBubble, MessageInput (shared UI)
- Types: Conversation, Message

#### `inspections/` - Property Inspections Domain
- API: Schedule, conduct, report inspections
- Hooks: useInspections, useInspection
- Types: Inspection, InspectionReport

#### `vendors/` - Vendor Management Domain
- API: Vendor profiles, ratings, banking
- Hooks: useVendors, useVendor
- Types: Vendor, VendorBankAccount

#### `auth/` - Authentication (Shared)
- Screens: Login, Register (used by all roles)
- API: Login, register, logout
- Hooks: useAuth, useUser
- Types: User, AuthSession

---

## 🔄 Data Flow

Role Screen (owner/tenant/vendor)
↓
Domain Hook (properties/leases/etc)
↓
Domain API (Supabase calls)
↓
Supabase Database

text

## ✅ Benefits

1. **Modularity**: Remove `tenant/` feature without breaking `owner/`
2. **Clear Separation**: Role screens vs business logic
3. **Code Reuse**: All roles share domain logic
4. **Easy Testing**: Mock domain hooks in role screens
5. **Scalable**: Add new roles (e.g., `admin/`) easily

## 🚫 Anti-Patterns (Don't Do This)

❌ Putting screens in domain features (properties/leases/etc)  
❌ Mixing role logic (owner code in tenant feature)  
❌ Direct Supabase calls in role screens (use domain hooks)  
❌ Role-specific logic in domain features  

## ✅ Good Patterns

✅ Role screens import domain hooks  
✅ Domain hooks call domain APIs  
✅ Shared UI components in `src/shared/components/`  
✅ Role-specific components in role features  

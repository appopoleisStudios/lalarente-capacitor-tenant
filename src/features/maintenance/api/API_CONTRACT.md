# 📋 Maintenance Feature API Contract

**Version:** 1.0  
**Date:** October 25, 2025  
**Status:** PROPOSED REFACTORING

---

## 🎯 Overview

This document defines the API contract for the maintenance feature, outlining the current structure and proposed refactoring to improve maintainability, testability, and code organization.

### Current State
- **maintenanceApi.ts**: 1451 lines (NEEDS REFACTORING)
- **quotesApi.ts**: 750+ lines (NEEDS REFACTORING)
- **messagesApi.ts**: 150 lines (ACCEPTABLE)
- **purchaseOrdersApi.ts**: 350+ lines (ACCEPTABLE)

### Goals
- Break large files into focused, single-responsibility modules
- Use modern ES6+ named exports instead of object exports
- Improve type safety and documentation
- Maintain backward compatibility during transition
- Follow project architecture (feature-based data layer)

---

## 📦 Proposed File Structure

```
src/features/maintenance/api/
├── index.ts                              # Barrel export (main entry point)
│
├── requests/                             # Maintenance Request Operations
│   ├── maintenanceRequests.api.ts       # Core CRUD operations
│   ├── maintenanceFilters.api.ts        # Filtering & search
│   ├── maintenanceWorkflow.api.ts       # Status updates, acknowledgment
│   └── maintenanceSubscriptions.api.ts  # Real-time subscriptions
│
├── vendors/                              # Vendor-Related Operations
│   ├── vendorRouting.api.ts             # Push to vendors, invitations
│   ├── vendorDiscovery.api.ts           # Find vendors by category/email
│   ├── vendorMaintenance.api.ts         # Vendor-specific request views
│   └── vendorQuoteRequests.api.ts       # Quote request management
│
├── work/                                 # Work Execution Operations
│   ├── workExecution.api.ts             # Start work, progress updates
│   ├── workClosure.api.ts               # Request closure, completion
│   └── workProgress.api.ts              # Progress tracking
│
├── quotes/                               # Quote Operations
│   ├── quotes.api.ts                    # Core quote CRUD
│   ├── quoteActions.api.ts              # Accept, reject, revise
│   ├── quoteRevisions.api.ts            # Revision tracking
│   └── quoteSubscriptions.api.ts        # Real-time quote updates
│
├── purchase-orders/                      # Purchase Order Operations
│   ├── purchaseOrders.api.ts            # Core PO CRUD
│   ├── poActions.api.ts                 # Status updates, sending
│   ├── poRevisions.api.ts               # Revision tracking
│   └── poAudit.api.ts                   # Audit trail for disputes
│
├── messages/                             # Messaging Operations
│   ├── messages.api.ts                  # Send, receive messages
│   └── messageSubscriptions.api.ts      # Real-time messaging
│
└── types/                                # Shared types
    ├── maintenance.types.ts             # Maintenance request types
    ├── vendor.types.ts                  # Vendor-related types
    ├── quote.types.ts                   # Quote types
    ├── po.types.ts                      # Purchase order types
    └── message.types.ts                 # Message types
```

---

## 🔍 Detailed API Breakdown

### 1. Maintenance Requests API (`requests/`)

#### **maintenanceRequests.api.ts** (~200 lines)
Core CRUD operations for maintenance requests.

```typescript
// GET operations
export async function getMaintenanceRequests(
  userId: string, 
  role?: 'owner' | 'tenant' | 'vendor'
): Promise<MaintenanceRequest[]>

export async function getMaintenanceRequestById(
  id: string
): Promise<MaintenanceRequestWithRelations>

export async function getOwnerProperties(
  ownerId: string
): Promise<Property[]>

export async function getPropertyOwner(
  propertyId: string
): Promise<string>

// CREATE operations
export async function createMaintenanceRequest(
  input: CreateMaintenanceRequestInput
): Promise<MaintenanceRequest>

// UPDATE operations
export async function updateMaintenanceRequest(
  id: string,
  updates: MaintenanceRequestUpdate
): Promise<MaintenanceRequest>

// DELETE operations
export async function deleteMaintenanceRequest(
  id: string
): Promise<{ success: boolean }>
```

**Dependencies:**
- Supabase client
- Type definitions from `types/maintenance.types.ts`

**Used by:**
- Owner screens (list, detail, create)
- Tenant screens (list, detail, create)
- Hooks: `useMaintenanceRequests`, `useMaintenanceDetail`

---

#### **maintenanceFilters.api.ts** (~100 lines)
Filtering and search operations.

```typescript
export async function filterByStatus(
  ownerId: string,
  statuses: MaintenanceStatus[]
): Promise<MaintenanceRequest[]>

export async function filterByPriority(
  ownerId: string,
  priorities: Priority[]
): Promise<MaintenanceRequest[]>

export async function getServiceCategories(): Promise<ServiceCategory[]>
```

**Dependencies:**
- Supabase client
- Type definitions from `types/maintenance.types.ts`

**Used by:**
- Owner maintenance list screen (filters)
- Create maintenance screen (category dropdown)

---

#### **maintenanceWorkflow.api.ts** (~150 lines)
Status updates and workflow management.

```typescript
export async function updateStatus(
  id: string,
  status: MaintenanceStatus
): Promise<MaintenanceRequest>

export async function updateMmsStatus(
  id: string,
  mmsStatus: MmsStatus
): Promise<MaintenanceRequest>

export async function updatePriority(
  id: string,
  priority: Priority
): Promise<MaintenanceRequest>

export async function acknowledgeRequest(
  id: string
): Promise<MaintenanceRequest>

export async function closeRequest(
  id: string
): Promise<MaintenanceRequest>
```

**Dependencies:**
- Supabase client
- Type definitions from `types/maintenance.types.ts`

**Used by:**
- Owner detail screen (acknowledge, close)
- Vendor job detail screen (status updates)

---

#### **maintenanceSubscriptions.api.ts** (~50 lines)
Real-time subscriptions for maintenance requests.

```typescript
export function subscribeToMaintenanceRequests(
  ownerId: string,
  callback: (payload: any) => void
): RealtimeChannel

export function unsubscribe(
  subscription: RealtimeChannel
): void
```

**Dependencies:**
- Supabase client

**Used by:**
- Hooks: `useMaintenanceRequests` (real-time updates)

---

### 2. Vendor Operations API (`vendors/`)

#### **vendorRouting.api.ts** (~200 lines)
Push requests to vendors and manage routing.

```typescript
export async function pushToOpenMarket(
  requestId: string
): Promise<MaintenanceRequest>

export async function pushToDedicatedVendors(
  requestId: string
): Promise<{
  request: MaintenanceRequest;
  vendorsNotified: number;
}>

export async function pushToSelectedVendors(
  requestId: string,
  vendorIds: string[]
): Promise<{
  request: MaintenanceRequest;
  vendorsNotified: number;
}>

export async function inviteVendorByEmail(
  email: string,
  requestId: string,
  ownerName: string
): Promise<{
  success: boolean;
  message: string;
  email: string;
}>
```

**Dependencies:**
- Supabase client
- `vendorDiscovery.api.ts` (for getting vendors)
- Type definitions from `types/maintenance.types.ts`, `types/vendor.types.ts`

**Used by:**
- Owner detail screen (push to vendors)

---

#### **vendorDiscovery.api.ts** (~150 lines)
Find and search for vendors.

```typescript
export async function getVendorsByCategory(
  categoryId: string
): Promise<VendorProfile[]>

export async function getDedicatedVendors(
  propertyId: string,
  categoryId?: string
): Promise<VendorProfile[]>

export async function getVendorsForRequest(
  requestId: string
): Promise<VendorProfile[]>

export async function searchVendorByEmail(
  email: string
): Promise<VendorProfile | null>

export async function getVendorCategories(
  vendorId: string
): Promise<ServiceCategory[]>
```

**Dependencies:**
- Supabase client
- Type definitions from `types/vendor.types.ts`

**Used by:**
- Owner detail screen (vendor selection)
- `vendorRouting.api.ts`

---

#### **vendorMaintenance.api.ts** (~400 lines)
Vendor-specific views of maintenance requests.

```typescript
export async function getAvailableRequests(
  vendorId: string,
  filters?: VendorMaintenanceFilters
): Promise<VendorMaintenanceRequest[]>

export async function getRequestById(
  requestId: string,
  vendorId: string
): Promise<VendorMaintenanceRequest>

export async function getMyJobs(
  vendorId: string
): Promise<VendorMaintenanceRequest[]>

export async function updateJobStatus(
  requestId: string,
  vendorId: string,
  update: JobStatusUpdate
): Promise<MaintenanceRequest>

export async function submitQuote(
  vendorId: string,
  quoteData: QuoteSubmission
): Promise<Quote>

export async function declineQuoteRequest(
  vendorId: string,
  requestId: string,
  reason?: string
): Promise<{ success: boolean; message: string }>
```

**Dependencies:**
- Supabase client
- Type definitions from `types/vendor.types.ts`, `types/maintenance.types.ts`

**Used by:**
- Vendor screens (dashboard, jobs list, request detail)
- Vendor hooks

---

#### **vendorQuoteRequests.api.ts** (~100 lines)
Manage vendor quote requests (invitations).

```typescript
export async function createQuoteRequests(
  requestId: string,
  vendorIds: string[]
): Promise<void>

export async function getQuoteRequestsForVendor(
  vendorId: string
): Promise<VendorQuoteRequest[]>

export async function updateQuoteRequestStatus(
  requestId: string,
  vendorId: string,
  status: QuoteRequestStatus
): Promise<void>
```

**Dependencies:**
- Supabase client
- Type definitions from `types/vendor.types.ts`

**Used by:**
- `vendorRouting.api.ts`
- `vendorMaintenance.api.ts`

---

### 3. Work Execution API (`work/`)

#### **workExecution.api.ts** (~150 lines)
Start and manage work execution.

```typescript
export async function startWork(
  requestId: string,
  vendorId: string
): Promise<MaintenanceRequest>

export async function submitProgressUpdate(
  requestId: string,
  vendorId: string,
  notes: string,
  photos: string[]
): Promise<ProgressUpdate>

export async function getProgressUpdates(
  requestId: string
): Promise<ProgressUpdate[]>
```

**Dependencies:**
- Supabase client
- Type definitions from `types/maintenance.types.ts`

**Used by:**
- Vendor job detail screen (start work, submit updates)

---

#### **workClosure.api.ts** (~100 lines)
Request and manage job closure.

```typescript
export async function requestClosure(
  requestId: string,
  vendorId: string,
  completionNotes: string,
  completionPhotos: string[]
): Promise<ClosureReport>

export async function getClosureReport(
  requestId: string
): Promise<ClosureReport | null>

export async function approveClosureReport(
  requestId: string,
  ownerId: string
): Promise<MaintenanceRequest>

export async function rejectClosureReport(
  requestId: string,
  ownerId: string,
  reason: string
): Promise<ClosureReport>
```

**Dependencies:**
- Supabase client
- Type definitions from `types/maintenance.types.ts`

**Used by:**
- Vendor job detail screen (request closure)
- Owner detail screen (approve/reject closure)

---

#### **workProgress.api.ts** (~50 lines)
Track work progress.

```typescript
export async function getProgressTimeline(
  requestId: string
): Promise<ProgressEvent[]>

export async function addProgressNote(
  requestId: string,
  vendorId: string,
  note: string
): Promise<ProgressNote>
```

**Dependencies:**
- Supabase client
- Type definitions from `types/maintenance.types.ts`

**Used by:**
- Owner/Vendor detail screens (progress timeline)

---

### 4. Quotes API (`quotes/`)

#### **quotes.api.ts** (~200 lines)
Core quote CRUD operations.

```typescript
export async function getQuotesByRequest(
  requestId: string
): Promise<Quote[]>

export async function getQuoteById(
  quoteId: string
): Promise<Quote>

export async function getApprovedQuote(
  requestId: string
): Promise<Quote | null>

export async function submitQuote(
  quoteData: QuoteSubmissionData
): Promise<Quote>

export async function updateQuote(
  quoteId: string,
  updateData: QuoteUpdateData,
  userId: string
): Promise<Quote>
```

**Dependencies:**
- Supabase client
- Type definitions from `types/quote.types.ts`

**Used by:**
- Owner detail screen (view quotes)
- Vendor quote submission screen
- Hooks: `useQuotes`

---

#### **quoteActions.api.ts** (~200 lines)
Accept, reject, and request revisions.

```typescript
export async function acceptQuote(
  quoteId: string,
  ownerId: string
): Promise<{
  quote: Quote;
  po: PurchaseOrder;
  message: string;
}>

export async function rejectQuote(
  quoteId: string,
  ownerId: string,
  rejectionReason?: string
): Promise<Quote>

export async function requestQuoteRevision(
  quoteId: string,
  ownerId: string,
  revisionReason: string
): Promise<Quote>

export async function generatePOFromQuote(
  quoteId: string,
  approvedQuote?: Quote
): Promise<PurchaseOrder>
```

**Dependencies:**
- Supabase client
- `quotes.api.ts`
- `purchaseOrders.api.ts`
- Type definitions from `types/quote.types.ts`, `types/po.types.ts`

**Used by:**
- Owner quote detail screen (accept, reject, request revision)

---

#### **quoteRevisions.api.ts** (~100 lines)
Track quote revision history.

```typescript
export async function getQuoteRevisions(
  quoteId: string
): Promise<QuoteRevision[]>

export async function createQuoteRevision(
  quoteId: string,
  revisionData: QuoteRevisionData,
  userId: string
): Promise<QuoteRevision>
```

**Dependencies:**
- Supabase client
- Type definitions from `types/quote.types.ts`

**Used by:**
- Owner/Vendor quote detail screens (revision history)

---

#### **quoteSubscriptions.api.ts** (~50 lines)
Real-time quote updates.

```typescript
export function subscribeToQuotes(
  requestId: string,
  callback: (quote: Quote) => void
): RealtimeChannel

export function unsubscribe(
  subscription: RealtimeChannel
): void
```

**Dependencies:**
- Supabase client
- `quotes.api.ts`

**Used by:**
- Hooks: `useQuotes` (real-time updates)

---

### 5. Purchase Orders API (`purchase-orders/`)

#### **purchaseOrders.api.ts** (~150 lines)
Core PO CRUD operations.

```typescript
export async function getPOById(
  poId: string
): Promise<PurchaseOrder>

export async function getPOByRequestId(
  requestId: string
): Promise<PurchaseOrder | null>

export async function getPOWithDetails(
  poId: string
): Promise<PurchaseOrderWithDetails>

export async function createPO(
  poData: POCreateData
): Promise<PurchaseOrder>

export async function updatePO(
  poId: string,
  updateData: POUpdateData,
  userId: string
): Promise<PurchaseOrder>
```

**Dependencies:**
- Supabase client
- Type definitions from `types/po.types.ts`

**Used by:**
- Owner PO detail screen
- Vendor PO detail screen
- `quoteActions.api.ts` (generate PO from quote)

---

#### **poActions.api.ts** (~100 lines)
PO status updates and actions.

```typescript
export async function updatePOStatus(
  poId: string,
  status: POStatus
): Promise<PurchaseOrder>

export async function sendPOToVendor(
  poId: string,
  scheduledStartDate: string,
  scheduledStartTime: string,
  workInstructions: string | null,
  sentBy: string
): Promise<PurchaseOrder>

export async function acceptPO(
  poId: string,
  vendorId: string
): Promise<PurchaseOrder>

export async function rejectPO(
  poId: string,
  vendorId: string,
  reason: string
): Promise<PurchaseOrder>
```

**Dependencies:**
- Supabase client
- `purchaseOrders.api.ts`
- Type definitions from `types/po.types.ts`

**Used by:**
- Owner PO detail screen (send to vendor)
- Vendor PO detail screen (accept, reject)

---

#### **poRevisions.api.ts** (~50 lines)
Track PO revision history.

```typescript
export async function getPORevisions(
  poId: string
): Promise<PORevision[]>

export async function createPORevision(
  poId: string,
  revisionData: PORevisionData,
  userId: string
): Promise<PORevision>
```

**Dependencies:**
- Supabase client
- Type definitions from `types/po.types.ts`

**Used by:**
- Owner/Vendor PO detail screens (revision history)

---

#### **poAudit.api.ts** (~50 lines)
Audit trail for dispute resolution.

```typescript
export async function getDisputeAuditTrail(
  requestId: string
): Promise<AuditTrail>

export async function getCompleteHistory(
  requestId: string
): Promise<{
  request: MaintenanceRequest;
  quotes: Quote[];
  po: PurchaseOrder | null;
  revisions: {
    quotes: QuoteRevision[];
    po: PORevision[];
  };
}>
```

**Dependencies:**
- Supabase client
- `quotes.api.ts`
- `purchaseOrders.api.ts`
- `quoteRevisions.api.ts`
- `poRevisions.api.ts`

**Used by:**
- Admin/Support screens (dispute resolution)

---

### 6. Messages API (`messages/`)

#### **messages.api.ts** (~100 lines)
Send and receive messages.

```typescript
export async function getMessages(
  requestId: string,
  propertyId: string
): Promise<Message[]>

export async function sendMessage(
  input: SendMessageInput
): Promise<Message>

export async function markAsRead(
  requestId: string,
  propertyId: string,
  userId: string
): Promise<void>

export async function getUnreadCount(
  userId: string
): Promise<number>
```

**Dependencies:**
- Supabase client
- Type definitions from `types/message.types.ts`

**Used by:**
- Owner/Vendor detail screens (messaging)

---

#### **messageSubscriptions.api.ts** (~50 lines)
Real-time messaging.

```typescript
export function subscribeToMessages(
  requestId: string,
  propertyId: string,
  callback: (message: Message) => void
): RealtimeChannel

export function unsubscribe(
  subscription: RealtimeChannel
): void
```

**Dependencies:**
- Supabase client
- `messages.api.ts`

**Used by:**
- Hooks: `useMessages` (real-time updates)

---

## 📊 Migration Strategy

### Phase 1: Create New Structure (No Breaking Changes)
1. Create new directory structure
2. Extract functions into new files
3. Keep old files intact
4. Update barrel export (`index.ts`) to export from both old and new

### Phase 2: Update Internal Dependencies
1. Update new API files to import from each other
2. Test all new APIs independently
3. Ensure backward compatibility

### Phase 3: Update Consumers (Gradual)
1. Update hooks to use new APIs
2. Update screens to use new APIs
3. Run tests after each update
4. Monitor for issues

### Phase 4: Deprecate Old Files
1. Add deprecation warnings to old exports
2. Update documentation
3. Remove old files after 1-2 sprints

---

## 🔧 Type Definitions

All types will be moved to dedicated type files:

### `types/maintenance.types.ts`
```typescript
export interface MaintenanceRequest { ... }
export interface MaintenanceRequestWithRelations { ... }
export interface CreateMaintenanceRequestInput { ... }
export interface MaintenanceRequestUpdate { ... }
export type MaintenanceStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed';
export type MmsStatus = 'notification' | 'acknowledged' | 'vendor_routed' | ...;
export type Priority = 'low' | 'medium' | 'high';
export interface ServiceCategory { ... }
export interface Property { ... }
export interface ProgressUpdate { ... }
export interface ClosureReport { ... }
```

### `types/vendor.types.ts`
```typescript
export interface VendorProfile { ... }
export interface VendorMaintenanceRequest { ... }
export interface VendorMaintenanceFilters { ... }
export interface VendorQuoteRequest { ... }
export interface QuoteSubmission { ... }
export type QuoteRequestStatus = 'pending' | 'responded' | 'declined';
```

### `types/quote.types.ts`
```typescript
export interface Quote { ... }
export interface QuoteRevision { ... }
export interface QuoteUpdateData { ... }
export interface QuoteSubmissionData { ... }
export type QuoteStatus = 'requested' | 'submitted' | 'approved' | 'rejected' | 'revision_requested';
```

### `types/po.types.ts`
```typescript
export interface PurchaseOrder { ... }
export interface PurchaseOrderWithDetails { ... }
export interface PORevision { ... }
export interface POUpdateData { ... }
export interface POCreateData { ... }
export type POStatus = 'issued' | 'accepted' | 'rejected' | 'completed';
```

### `types/message.types.ts`
```typescript
export interface Message { ... }
export interface SendMessageInput { ... }
export type MessageType = 'text' | 'image' | 'file';
```

---

## ✅ Benefits of This Refactoring

1. **Single Responsibility**: Each file has one clear purpose
2. **Easier Testing**: Smaller files are easier to unit test
3. **Better Navigation**: Developers can find functions quickly
4. **Improved Maintainability**: Changes are isolated to specific files
5. **Type Safety**: Centralized type definitions
6. **Modern Standards**: Named exports, ES6+ syntax
7. **Scalability**: Easy to add new features without bloating files
8. **Team Collaboration**: Reduced merge conflicts

---

## 📝 Next Steps

1. **Review this contract** - Ensure all stakeholders agree
2. **Create type files** - Start with type definitions
3. **Extract functions** - Begin with smallest modules first
4. **Update barrel export** - Maintain backward compatibility
5. **Update tests** - Ensure all tests pass
6. **Update documentation** - Keep docs in sync
7. **Gradual migration** - Update consumers incrementally

---

**Questions? Concerns? Feedback?**  
Please review this contract and provide input before we proceed with implementation.

# Revision Tracking System

## Overview
Implemented a comprehensive revision tracking system for quotes and purchase orders, similar to UrbanClap/Uber's dispute resolution mechanism. Every edit creates a new revision with full historical tracking for transparency.

## Features

### 1. Quote Editing with Revisions
- **Vendor can edit quotes** after submission if owner requests changes
- **New status**: `revision_requested` - Owner can request vendor to revise quote
- **Revision tracking**: Every quote update creates a revision record
- **Revision number**: Auto-incremented with each edit
- **Revision reason**: Mandatory field explaining why the change was made

### 2. Auto-Generate PO from Quote
- **Automatic PO creation** when quote is approved
- **PO inherits** all quote details (amounts, contract_id, etc.)
- **PO number format**: `PO-YYYYMMDD-XXXX` (date + random)
- **Links to request**: Updates `maintenance_requests.po_id` automatically

### 3. PO Editing with Revisions (Owner Only)
- **Owner can edit PO** after generation
- **Revision tracking**: Every PO update creates a revision record
- **Revision number**: Auto-incremented with each edit
- **Revision reason**: Mandatory field for audit trail

### 4. Dispute Resolution Audit Trail
- **Complete history**: Get all quote and PO revisions for a request
- **Transparent tracking**: Who changed what, when, and why
- **Easy dispute resolution**: Full historical context available

## API Methods

### Quote API (`quotesApi`)

#### `updateQuote(quoteId, updateData, userId)`
Update a quote with revision tracking.
```typescript
const updatedQuote = await quotesApi.updateQuote(
  'quote-id',
  {
    subtotal: 1000,
    vat_amount: 150,
    total_amount: 1150,
    revision_reason: 'Owner requested lower price'
  },
  'vendor-user-id'
);
```

#### `requestRevision(quoteId, reason)`
Owner requests vendor to revise the quote.
```typescript
await quotesApi.requestRevision(
  'quote-id',
  'Please reduce the labor cost'
);
```

#### `getQuoteRevisions(quoteId)`
Get all revisions for a quote.
```typescript
const revisions = await quotesApi.getQuoteRevisions('quote-id');
// Returns: [{ revision_number: 0, subtotal: 1200, ... }, { revision_number: 1, subtotal: 1000, ... }]
```

#### `generatePOFromQuote(quoteId)`
Auto-generate PO from approved quote.
```typescript
const po = await quotesApi.generatePOFromQuote('quote-id');
// Creates PO and links it to maintenance request
```

### Purchase Order API (`purchaseOrdersApi`)

#### `updatePO(poId, updateData, userId)`
Update a PO with revision tracking (owner only).
```typescript
const updatedPO = await purchaseOrdersApi.updatePO(
  'po-id',
  {
    platform_fee_amount: 50,
    total_amount: 1200,
    revision_reason: 'Added platform fee'
  },
  'owner-user-id'
);
```

#### `getPORevisions(poId)`
Get all revisions for a PO.
```typescript
const revisions = await purchaseOrdersApi.getPORevisions('po-id');
// Returns: [{ revision_number: 1, total_amount: 1150, ... }, { revision_number: 2, total_amount: 1200, ... }]
```

#### `getDisputeAuditTrail(requestId)`
Get complete audit trail for dispute resolution.
```typescript
const auditTrail = await purchaseOrdersApi.getDisputeAuditTrail('request-id');
// Returns: {
//   request_id: 'request-id',
//   quote_history: [...all quote revisions...],
//   po_history: [...all PO revisions...]
// }
```

## Database Schema Requirements

### New Tables Needed

#### `quote_revisions`
```sql
CREATE TABLE quote_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  subtotal DECIMAL(10,2),
  vat_amount DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  notes TEXT,
  revised_by UUID NOT NULL REFERENCES profiles(id),
  revision_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_quote_revisions_quote_id ON quote_revisions(quote_id);
```

#### `po_revisions`
```sql
CREATE TABLE po_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  subtotal DECIMAL(10,2),
  vat_amount DECIMAL(10,2),
  platform_fee_amount DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  revised_by UUID NOT NULL REFERENCES profiles(id),
  revision_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_po_revisions_po_id ON po_revisions(po_id);
```

### Updated Columns

#### `quotes` table
```sql
ALTER TABLE quotes 
  ADD COLUMN revision_number INTEGER DEFAULT 0,
  ADD COLUMN revision_reason TEXT,
  ALTER COLUMN status TYPE VARCHAR(50); -- Add 'revision_requested' to enum
```

#### `purchase_orders` table
```sql
ALTER TABLE purchase_orders 
  ADD COLUMN revision_number INTEGER DEFAULT 1,
  ADD COLUMN revision_reason TEXT;
```

## Workflow Examples

### Scenario 1: Owner Requests Quote Revision
1. Vendor submits quote (revision 0)
2. Owner reviews and requests changes: `requestRevision(quoteId, "Please reduce labor cost")`
3. Quote status → `revision_requested`
4. Vendor edits quote: `updateQuote(quoteId, { subtotal: 900, ... }, vendorId)`
5. System creates revision record (revision 0 saved)
6. Quote updated with new values (revision 1)
7. Quote status → `submitted`

### Scenario 2: Auto-Generate PO and Owner Edits
1. Owner approves quote
2. System auto-generates PO: `generatePOFromQuote(quoteId)`
3. PO created with revision 1
4. Owner edits PO: `updatePO(poId, { platform_fee_amount: 50, ... }, ownerId)`
5. System creates revision record (revision 1 saved)
6. PO updated with new values (revision 2)

### Scenario 3: Dispute Resolution
1. Dispute arises between owner and vendor
2. Get audit trail: `getDisputeAuditTrail(requestId)`
3. System returns complete history:
   - All quote revisions with reasons
   - All PO revisions with reasons
   - Who made each change and when
4. Both parties can see transparent history
5. Dispute resolved based on documented changes

## Benefits

✅ **Transparency**: Full history of all changes
✅ **Accountability**: Track who made what changes
✅ **Dispute Resolution**: Easy to resolve conflicts with historical data
✅ **Audit Trail**: Complete record for compliance
✅ **Trust**: Similar to UrbanClap/Uber's proven system
✅ **Flexibility**: Vendors can revise, owners can edit POs

## Next Steps

1. **Create database migrations** for new tables and columns
2. **Add RLS policies** for quote_revisions and po_revisions tables
3. **Update UI** to show revision history
4. **Add notifications** when revision is requested
5. **Implement dispute resolution UI** with audit trail display

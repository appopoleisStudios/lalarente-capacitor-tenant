# 🚀 Quick Reference Guide

## "Where do I find...?"

### Maintenance Request Operations

**"I need to fetch maintenance requests"**
```typescript
import { getMaintenanceRequests } from '@/features/maintenance/api/requests/maintenanceRequests.api';
```
📁 File: `requests/maintenanceRequests.api.ts`

**"I need to filter requests by status"**
```typescript
import { filterByStatus } from '@/features/maintenance/api/requests/maintenanceFilters.api';
```
📁 File: `requests/maintenanceFilters.api.ts`

**"I need to update request status"**
```typescript
import { updateStatus } from '@/features/maintenance/api/requests/maintenanceWorkflow.api';
```
📁 File: `requests/maintenanceWorkflow.api.ts`

**"I need real-time updates"**
```typescript
import { subscribeToMaintenanceRequests } from '@/features/maintenance/api/requests/maintenanceSubscriptions.api';
```
📁 File: `requests/maintenanceSubscriptions.api.ts`

---

### Vendor Operations

**"I need to find vendors by category"**
```typescript
import { getVendorsByCategory } from '@/features/maintenance/api/vendors/vendorDiscovery.api';
```
📁 File: `vendors/vendorDiscovery.api.ts`

**"I need to push request to vendors"**
```typescript
import { pushToOpenMarket, pushToDedicatedVendors } from '@/features/maintenance/api/vendors/vendorRouting.api';
```
📁 File: `vendors/vendorRouting.api.ts`

**"I need vendor's view of requests"**
```typescript
import { getAvailableRequests, getMyJobs } from '@/features/maintenance/api/vendors/vendorMaintenance.api';
```
📁 File: `vendors/vendorMaintenance.api.ts`

---

### Work Execution

**"I need to start work on a job"**
```typescript
import { startWork } from '@/features/maintenance/api/work/workExecution.api';
```
📁 File: `work/workExecution.api.ts`

**"I need to submit progress updates"**
```typescript
import { submitProgressUpdate } from '@/features/maintenance/api/work/workExecution.api';
```
📁 File: `work/workExecution.api.ts`

**"I need to request job closure"**
```typescript
import { requestClosure } from '@/features/maintenance/api/work/workClosure.api';
```
📁 File: `work/workClosure.api.ts`

---

### Quote Operations

**"I need to get quotes for a request"**
```typescript
import { getQuotesByRequest } from '@/features/maintenance/api/quotes/quotes.api';
```
📁 File: `quotes/quotes.api.ts`

**"I need to accept/reject a quote"**
```typescript
import { acceptQuote, rejectQuote } from '@/features/maintenance/api/quotes/quoteActions.api';
```
📁 File: `quotes/quoteActions.api.ts`

**"I need quote revision history"**
```typescript
import { getQuoteRevisions } from '@/features/maintenance/api/quotes/quoteRevisions.api';
```
📁 File: `quotes/quoteRevisions.api.ts`

**"I need real-time quote updates"**
```typescript
import { subscribeToQuotes } from '@/features/maintenance/api/quotes/quoteSubscriptions.api';
```
📁 File: `quotes/quoteSubscriptions.api.ts`

---

### Purchase Order Operations

**"I need to get a PO"**
```typescript
import { getPOById, getPOByRequestId } from '@/features/maintenance/api/purchase-orders/purchaseOrders.api';
```
📁 File: `purchase-orders/purchaseOrders.api.ts`

**"I need to update PO status"**
```typescript
import { updatePOStatus, sendPOToVendor } from '@/features/maintenance/api/purchase-orders/poActions.api';
```
📁 File: `purchase-orders/poActions.api.ts`

**"I need PO revision history"**
```typescript
import { getPORevisions } from '@/features/maintenance/api/purchase-orders/poRevisions.api';
```
📁 File: `purchase-orders/poRevisions.api.ts`

**"I need audit trail for disputes"**
```typescript
import { getDisputeAuditTrail } from '@/features/maintenance/api/purchase-orders/poAudit.api';
```
📁 File: `purchase-orders/poAudit.api.ts`

---

### Messaging

**"I need to send/receive messages"**
```typescript
import { getMessages, sendMessage } from '@/features/maintenance/api/messages/messages.api';
```
📁 File: `messages/messages.api.ts`

**"I need real-time messaging"**
```typescript
import { subscribeToMessages } from '@/features/maintenance/api/messages/messageSubscriptions.api';
```
📁 File: `messages/messageSubscriptions.api.ts`

---

## 📦 Import Patterns

### Option 1: Direct Import (Recommended)
```typescript
// Import specific function from specific file
import { getMaintenanceRequests } from '@/features/maintenance/api/requests/maintenanceRequests.api';
```
✅ Best for tree-shaking  
✅ Clear dependencies  
✅ Faster IDE autocomplete

### Option 2: Barrel Import (Convenience)
```typescript
// Import from barrel export
import { getMaintenanceRequests } from '@/features/maintenance/api';
```
✅ Shorter import path  
⚠️ May import more than needed

### Option 3: Namespace Import (Grouping)
```typescript
// Import all functions from a module
import * as MaintenanceAPI from '@/features/maintenance/api/requests/maintenanceRequests.api';

// Usage
MaintenanceAPI.getMaintenanceRequests(userId, role);
```
✅ Clear namespace  
✅ Avoid naming conflicts  
⚠️ Longer function calls

---

## 🎯 Common Use Cases

### Use Case 1: Owner Views Maintenance List
```typescript
import { getMaintenanceRequests } from '@/features/maintenance/api/requests/maintenanceRequests.api';
import { subscribeToMaintenanceRequests } from '@/features/maintenance/api/requests/maintenanceSubscriptions.api';

// Fetch initial data
const requests = await getMaintenanceRequests(ownerId, 'owner');

// Subscribe to updates
const subscription = subscribeToMaintenanceRequests(ownerId, (payload) => {
  // Handle real-time update
});
```

### Use Case 2: Owner Accepts Quote
```typescript
import { acceptQuote } from '@/features/maintenance/api/quotes/quoteActions.api';

// Accept quote (auto-generates PO)
const result = await acceptQuote(quoteId, ownerId);
console.log('Quote accepted:', result.quote);
console.log('PO generated:', result.po);
```

### Use Case 3: Vendor Submits Quote
```typescript
import { submitQuote } from '@/features/maintenance/api/vendors/vendorMaintenance.api';

const quote = await submitQuote(vendorId, {
  request_id: requestId,
  subtotal: 1000,
  vat_amount: 150,
  total_amount: 1150,
  notes: 'Quote details...',
  line_items: [
    { name: 'Labor', quantity: 2, unit_price: 500 }
  ]
});
```

### Use Case 4: Vendor Starts Work
```typescript
import { startWork } from '@/features/maintenance/api/work/workExecution.api';
import { submitProgressUpdate } from '@/features/maintenance/api/work/workExecution.api';

// Start work
await startWork(requestId, vendorId);

// Submit daily update
await submitProgressUpdate(requestId, vendorId, 'Progress notes', ['photo1.jpg']);
```

### Use Case 5: Owner Sends PO to Vendor
```typescript
import { sendPOToVendor } from '@/features/maintenance/api/purchase-orders/poActions.api';

await sendPOToVendor(
  poId,
  '2025-10-30',           // scheduled start date
  '09:00',                // scheduled start time
  'Access code: 1234',    // work instructions
  ownerId                 // sent by
);
```

---

## 🔍 Function Finder

### By Role

#### Owner Functions
- `getMaintenanceRequests()` - View all my requests
- `createMaintenanceRequest()` - Create new request
- `acknowledgeRequest()` - Acknowledge tenant request
- `pushToOpenMarket()` - Push to open market
- `pushToDedicatedVendors()` - Push to my vendors
- `acceptQuote()` - Accept vendor quote
- `rejectQuote()` - Reject vendor quote
- `sendPOToVendor()` - Send PO with schedule

#### Tenant Functions
- `getMaintenanceRequests()` - View my requests
- `createMaintenanceRequest()` - Report issue
- `getMessages()` - View messages
- `sendMessage()` - Send message

#### Vendor Functions
- `getAvailableRequests()` - View available jobs
- `getMyJobs()` - View my active jobs
- `submitQuote()` - Submit quote
- `declineQuoteRequest()` - Decline quote request
- `startWork()` - Start work on job
- `submitProgressUpdate()` - Submit daily update
- `requestClosure()` - Request job closure

---

## 📚 Type Imports

```typescript
// Maintenance types
import type { 
  MaintenanceRequest,
  MaintenanceStatus,
  Priority 
} from '@/features/maintenance/api/types/maintenance.types';

// Vendor types
import type { 
  VendorProfile,
  VendorMaintenanceRequest 
} from '@/features/maintenance/api/types/vendor.types';

// Quote types
import type { 
  Quote,
  QuoteStatus 
} from '@/features/maintenance/api/types/quote.types';

// PO types
import type { 
  PurchaseOrder,
  POStatus 
} from '@/features/maintenance/api/types/po.types';

// Message types
import type { 
  Message,
  SendMessageInput 
} from '@/features/maintenance/api/types/message.types';
```

---

## 🆘 Troubleshooting

### "I can't find a function"
1. Check this guide's "Where do I find...?" section
2. Search in API_CONTRACT.md for detailed info
3. Check the old maintenanceApi.ts (deprecated but still works)

### "Import is not working"
1. Verify the file path is correct
2. Check if the function is exported
3. Try importing from barrel export: `@/features/maintenance/api`

### "Type errors"
1. Import types from `types/` directory
2. Check API_CONTRACT.md for correct type definitions
3. Ensure you're using the latest type definitions

### "Function behavior changed"
1. Check API_CONTRACT.md for function signature
2. Review migration notes in REFACTORING_SUMMARY.md
3. Check if function was moved to a different module

---

## 💡 Tips

1. **Use TypeScript autocomplete**: Start typing the function name and let your IDE suggest the import
2. **Import types separately**: Use `import type { ... }` for type-only imports
3. **Group related imports**: Import multiple functions from the same file in one statement
4. **Use barrel exports for convenience**: Import from `@/features/maintenance/api` when you need multiple functions
5. **Check function documentation**: Each function has JSDoc comments explaining parameters and return values

---

## 🔗 Related Documentation

- **API_CONTRACT.md** - Complete API specification
- **REFACTORING_SUMMARY.md** - Before/after comparison
- **ARCHITECTURE_GUIDE.md** - Project architecture overview

---

**Need help?** Check the detailed API_CONTRACT.md or ask the team! 🚀

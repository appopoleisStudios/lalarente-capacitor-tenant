# Task 3 Implementation Summary: Fix Owner Maintenance Detail Screen Data Fetching

## Overview
Fixed the Owner Maintenance Detail Screen to correctly fetch purchase orders using the direct `maintenance_requests.po_id` reference instead of incorrectly attempting to fetch through `quotes.contract_id`.

## Changes Made

### 1. Updated Imports
Added necessary imports for the quotes and purchase orders APIs:
```typescript
import { quotesApi } from '@/src/features/maintenance/api/quotesApi';
import { purchaseOrdersApi, PurchaseOrder } from '@/src/features/maintenance/api/purchaseOrdersApi';
```

### 2. Updated Component State
Added separate state variables for quotes and purchase order:
```typescript
const [quotes, setQuotes] = useState<any[]>([]);
const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
```

### 3. Fixed `fetchRequest()` Function
**Before:** The function only fetched the maintenance request, which included quotes as nested data.

**After:** The function now:
1. Fetches the main maintenance request
2. Separately fetches quotes using `quotesApi.getQuotesByRequest(id)`
3. Fetches PO using the DIRECT `request.po_id` reference via `purchaseOrdersApi.getPOById()`
4. Handles errors gracefully for each fetch operation without breaking the screen

```typescript
const fetchRequest = async () => {
  try {
    setLoading(true);
    
    // 1. Fetch main request
    const data = await maintenanceApi.getMaintenanceRequestById(id);
    setRequest(data);
    
    // 2. Fetch quotes for this request
    try {
      const quotesData = await quotesApi.getQuotesByRequest(id);
      setQuotes(quotesData);
    } catch (error) {
      console.log('Failed to fetch quotes:', error);
      setQuotes([]);
    }
    
    // 3. Fetch PO using the DIRECT po_id reference (CORRECTED)
    const poId = (data as any)?.po_id;
    if (poId) {
      try {
        const po = await purchaseOrdersApi.getPOById(poId);
        setPurchaseOrder(po);
      } catch (error) {
        console.log('Failed to fetch PO:', error);
        setPurchaseOrder(null);
      }
    } else {
      setPurchaseOrder(null);
    }
    
  } catch (error: any) {
    console.error('Error fetching request:', error);
    Alert.alert('Error', 'Failed to load request details');
  } finally {
    setLoading(false);
  }
};
```

### 4. Updated Quotes Rendering
Changed from `request.quotes` to the separate `quotes` state:
```typescript
{quotes && quotes.length > 0 && (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Vendor Quotes</Text>
      <Text style={styles.sectionBadge}>{quotes.length} received</Text>
    </View>
    {quotes.map((quote: any) => (
      // ... quote card rendering
    ))}
  </View>
)}
```

### 5. Updated Purchase Order Display
Enhanced PO display to:
- Use the `purchaseOrder` state instead of just checking `request.po_id`
- Display PO number and total amount
- Show contract reference when available (contract_id is not null)

```typescript
{purchaseOrder && (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Purchase Order</Text>
      <Text style={[styles.sectionBadge, { backgroundColor: colors.success[50], color: colors.success[700] }]}>
        Issued
      </Text>
    </View>
    <TouchableOpacity style={styles.poCard} onPress={...}>
      <View style={styles.poHeader}>
        <Ionicons name="document-text" size={32} color={RSA.blue} />
        <View style={styles.poInfo}>
          <Text style={styles.poNumber}>{purchaseOrder.po_number}</Text>
          <Text style={styles.poAmount}>
            R {purchaseOrder.total_amount?.toLocaleString() || '0'}
          </Text>
          
          {/* Contract Reference - only shown when contract exists */}
          {purchaseOrder.contract && (
            <View style={styles.poContractRef}>
              <Ionicons name="link-outline" size={14} color={colors.gray[500]} />
              <Text style={styles.poContractText}>
                Contract: {purchaseOrder.contract.contract_number}
              </Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
      </View>
    </TouchableOpacity>
  </View>
)}
```

### 6. Updated Timeline
Changed timeline to use the separate states:
- Uses `quotes` state instead of `request.quotes`
- Uses `purchaseOrder.created_at` for PO issued date

### 7. Updated Edge Case Logic
Updated the logic for checking unquoted open market and dedicated vendors:
```typescript
const isUnquotedOpenMarket = request.acknowledged_at && 
                              request.vendor_routed_at && 
                              request.visibility === 'public' &&
                              (!quotes || quotes.length === 0) &&
                              request.status === 'open';

const canSendToDedicatedVendors = request.acknowledged_at && !purchaseOrder;
```

### 8. Added New Styles
Added styles for PO amount and contract reference:
```typescript
poAmount: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 4 },
poContractRef: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
poContractText: { fontSize: 12, color: colors.gray[600] },
```

## Error Handling

The implementation includes graceful error handling for all three scenarios:

1. **No PO Yet** (`request.po_id` is null)
   - PO section is not displayed
   - No errors thrown

2. **PO Fetch Fails** (network error, permissions, etc.)
   - Error is logged to console
   - `purchaseOrder` state is set to null
   - Screen continues to function normally

3. **Quotes Fetch Fails**
   - Error is logged to console
   - `quotes` state is set to empty array
   - Screen continues to function normally

## Requirements Satisfied

✅ **Requirement 1.1**: Fetch PO using `maintenance_requests.po_id` instead of `quotes.contract_id`
✅ **Requirement 1.5**: Use direct `maintenance_requests.po_id` reference
✅ **Requirement 3.1**: Load maintenance request and fetch PO using `request.po_id`
✅ **Requirement 3.2**: Don't attempt to fetch PO through `quote.contract_id`
✅ **Requirement 3.5**: Handle all three scenarios (no PO, PO with contract, PO without contract)

## Testing Recommendations

Test the following scenarios:

1. **Request with PO (no contract)**
   - Verify PO displays with number and amount
   - Verify no contract reference is shown

2. **Request with PO (with contract)**
   - Verify PO displays with number and amount
   - Verify contract reference is shown

3. **Request without PO**
   - Verify PO section is not displayed
   - Verify no errors occur

4. **Request with mixed quotes**
   - Verify all quotes display correctly
   - Verify contract badges appear on appropriate quotes

5. **Network errors**
   - Verify screen doesn't crash if PO fetch fails
   - Verify screen doesn't crash if quotes fetch fails

## Database Schema Fixes

During implementation, we discovered that the API queries were referencing columns that don't exist in the actual database schema:

### Fixed in `quotesApi.ts`:
- **Removed `business_name`** from vendor profile queries (column doesn't exist in `profiles` table)
- **Removed `contract_number`** from service_contracts queries (column doesn't exist in `service_contracts` table)
- Updated `Quote` interface to reflect actual schema
- Made `status` nullable in contract interface

### Fixed in `purchaseOrdersApi.ts`:
- **Removed `contract_number`** from service_contracts queries (column doesn't exist)
- Updated `ServiceContract` interface to match actual schema
- Made `vendor_id`, `status`, `start_date`, and `end_date` nullable

### Fixed in `OwnerMaintenanceDetailScreen.tsx`:
- Changed contract display from showing `contract_number` to showing "Linked to Service Contract"
- This provides a visual indicator that a contract exists without relying on non-existent fields

These fixes ensure the queries match the actual Supabase database schema and prevent PostgreSQL errors.

## Files Modified

- `lalarente-app/src/features/owner/screens/OwnerMaintenanceDetailScreen.tsx`
- `lalarente-app/src/features/maintenance/api/quotesApi.ts` (schema fixes)
- `lalarente-app/src/features/maintenance/api/purchaseOrdersApi.ts` (schema fixes)

## TypeScript Compliance

✅ No TypeScript errors
✅ Proper typing for PurchaseOrder interface
✅ Proper null checks for optional fields
✅ API interfaces match actual database schema

# Phase 2 Implementation Guide

**Goal:** Complete the maintenance request detail screen with all missing features

---

## 📋 Features to Implement

### 1. **Chat Screen (WhatsApp-like)** 🔥 Priority
- Real-time messaging between owner and tenant/vendor
- Message history
- Read receipts
- Typing indicators
- Image/file sharing

### 2. **Purchase Order (PO) Detail Screen**
- PO number and details
- Vendor information
- Line items breakdown
- Terms and conditions
- Download/share PO

### 3. **Invoice Detail Screen**
- Invoice number and details
- Payment status
- Due date tracking
- Payment history
- Download/share invoice

### 4. **Quote API Endpoints**
- Accept quote
- Reject quote
- Request quote revisions
- Compare quotes

### 5. **Real-time Functionality**
- Live chat updates
- Status change notifications
- Quote submission alerts

---

## 🗄️ Database Exploration Steps

### **Step 1: Run Database Queries**

Open `PHASE2_DATABASE_EXPLORATION.sql` and run the queries in Supabase SQL Editor to discover:

1. **Chat/Messages Tables**
   - Table structure
   - Sample data
   - Foreign key relationships

2. **Quotes Tables**
   - Quote structure
   - Quote requests
   - Vendor relationships

3. **Purchase Orders Tables**
   - PO structure
   - PO numbering system
   - Status tracking

4. **Invoices Tables**
   - Invoice structure
   - Payment tracking
   - Due dates

5. **Timeline/Activity Tables**
   - Activity logs
   - Status changes
   - User actions

6. **Work Updates Tables**
   - Progress updates
   - Vendor updates
   - Photo uploads

### **Step 2: Share Results**

After running the queries, share:
- Table structures (column names, types)
- Sample data (5-10 rows)
- Foreign key relationships
- Any existing data

---

## 🏗️ Architecture Plan

### **Folder Structure:**

```
src/features/
├── maintenance/
│   ├── api/
│   │   ├── maintenanceApi.ts (existing)
│   │   ├── quotesApi.ts (new)
│   │   ├── purchaseOrdersApi.ts (new)
│   │   ├── invoicesApi.ts (new)
│   │   └── messagesApi.ts (new)
│   ├── components/
│   │   ├── MediaGallery.tsx (existing)
│   │   ├── ChatBubble.tsx (new)
│   │   ├── ChatInput.tsx (new)
│   │   ├── QuoteCard.tsx (new)
│   │   └── InvoiceItem.tsx (new)
│   └── hooks/
│       ├── useMaintenanceRequests.ts (existing)
│       ├── useMessages.ts (new)
│       ├── useQuotes.ts (new)
│       └── useRealtime.ts (new)
├── owner/
│   └── screens/
│       ├── OwnerMaintenanceDetailScreen.tsx (existing)
│       ├── ChatScreen.tsx (new)
│       ├── PurchaseOrderScreen.tsx (new)
│       └── InvoiceScreen.tsx (new)
```

### **Routes to Create:**

```
app/(owner)/maintenance/
├── [id].tsx (existing)
├── [id]/
│   ├── chat.tsx (new)
│   ├── purchase-order.tsx (new)
│   └── invoice.tsx (new)
```

---

## 🎯 Implementation Priority

### **Phase 2A: Core Functionality** (2-3 hours)
1. ✅ Quote API endpoints
2. ✅ Accept/Reject quote functionality
3. ✅ PO generation on quote acceptance
4. ✅ Basic chat screen structure

### **Phase 2B: Chat Implementation** (2-3 hours)
1. ✅ Messages API
2. ✅ Chat UI (WhatsApp-like)
3. ✅ Real-time messaging
4. ✅ Message history
5. ✅ Read receipts

### **Phase 2C: Detail Screens** (1-2 hours)
1. ✅ PO detail screen
2. ✅ Invoice detail screen
3. ✅ Download/share functionality

### **Phase 2D: Polish** (1 hour)
1. ✅ Loading states
2. ✅ Error handling
3. ✅ Empty states
4. ✅ Animations

---

## 📊 Expected Database Tables

Based on typical maintenance systems, we expect:

### **messages**
```sql
- id (uuid)
- request_id (uuid) -> maintenance_requests
- sender_id (uuid) -> profiles
- recipient_id (uuid) -> profiles
- content (text)
- message_type (text/image/file)
- read_at (timestamp)
- created_at (timestamp)
```

### **quotes**
```sql
- id (uuid)
- request_id (uuid) -> maintenance_requests
- vendor_id (uuid) -> profiles
- total_amount (numeric)
- breakdown (jsonb)
- estimated_duration (text)
- warranty_period (text)
- notes (text)
- status (submitted/accepted/rejected)
- submitted_at (timestamp)
- valid_until (timestamp)
```

### **purchase_orders**
```sql
- id (uuid)
- request_id (uuid) -> maintenance_requests
- quote_id (uuid) -> quotes
- vendor_id (uuid) -> profiles
- po_number (text)
- total_amount (numeric)
- status (issued/in_progress/completed)
- issued_date (timestamp)
- expected_completion_date (timestamp)
```

### **invoices**
```sql
- id (uuid)
- request_id (uuid) -> maintenance_requests
- po_id (uuid) -> purchase_orders
- invoice_number (text)
- total_amount (numeric)
- status (pending/paid/overdue)
- issued_date (timestamp)
- due_date (timestamp)
- paid_date (timestamp)
```

---

## 🚀 Next Steps

1. **Run the SQL queries** in `PHASE2_DATABASE_EXPLORATION.sql`
2. **Share the results** (table structures and sample data)
3. **I'll implement** the features based on actual database structure
4. **Test** each feature as we build
5. **Iterate** based on feedback

---

## 💡 Key Decisions Needed

Before implementation, we need to know:

1. **Chat System:**
   - Is there a `messages` table?
   - Is there a `conversations` table?
   - How are messages linked to requests?

2. **Quotes:**
   - How are quotes structured?
   - Is there a quote approval workflow?
   - How is PO generated from quote?

3. **Real-time:**
   - Should we use Supabase Realtime?
   - Or polling?
   - What events need real-time updates?

4. **File Sharing:**
   - Can users share files in chat?
   - Where are files stored?
   - What file types are allowed?

---

**Ready to proceed once you share the database query results!** 🎉

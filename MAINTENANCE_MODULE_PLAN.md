# 🔧 LALARENTE MAINTENANCE MODULE - Development Plan
**Date:** October 15, 2025  
**Status:** Day 2 Development  
**Module:** Complete Maintenance Management System

---

## 📋 CLIENT REQUIREMENTS SUMMARY

### **6-Step Maintenance Process:**
1. **Raise Notification** (Tenant reports issue)
2. **Acknowledge** (Landlord reviews & pushes to vendors)
3. **Vendor Selection** (Get quotes & availability)
4. **Issue PO** (Generate purchase order)
5. **Execute Work** (Schedule → Assess → Work → Document)
6. **Close Work** (Report → Invoice → Payment → Archive)

---

## 🎯 TODAY'S OBJECTIVES (Oct 15, 2025)

### **Phase 1: Database Design (1 hour)**
- [ ] Design Supabase schema
- [ ] Create tables for maintenance workflow
- [ ] Setup relationships & triggers
- [ ] Plan file storage structure

### **Phase 2: Core Screens (3 hours)**
- [ ] Report Maintenance Screen (Tenant)
- [ ] Maintenance List Screen (Landlord)
- [ ] Maintenance Detail Screen (All users)
- [ ] Status tracking system

### **Phase 3: Backend Integration (1 hour)**
- [ ] Setup Supabase client
- [ ] Connect authentication
- [ ] Implement real-time subscriptions
- [ ] Test CRUD operations

### **Phase 4: Testing (1 hour)**
- [ ] End-to-end workflow testing
- [ ] Bug fixes
- [ ] Performance optimization

---

## 🗄️ DATABASE SCHEMA

-- Maintenance Requests (Notifications)
CREATE TABLE maintenance_requests (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
request_number TEXT UNIQUE NOT NULL, -- Auto-generated MNT-XXXXX
property_id UUID REFERENCES properties(id),
tenant_id UUID REFERENCES users(id),
landlord_id UUID REFERENCES users(id),

-- Issue Details
title TEXT NOT NULL,
description TEXT NOT NULL,
location TEXT, -- Location within property
priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
category TEXT, -- Plumbing, Electrical, etc.

-- Status Tracking
status TEXT CHECK (status IN ('open', 'acknowledged', 'quoted', 'scheduled', 'in_progress', 'completed', 'closed')),

-- Timestamps
reported_at TIMESTAMP DEFAULT NOW(),
acknowledged_at TIMESTAMP,
scheduled_at TIMESTAMP,
completed_at TIMESTAMP,
closed_at TIMESTAMP,

-- Metadata
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- Maintenance Attachments (Photos/Videos)
CREATE TABLE maintenance_attachments (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
request_id UUID REFERENCES maintenance_requests(id) ON DELETE CASCADE,
file_url TEXT NOT NULL,
file_type TEXT, -- image/video
file_name TEXT,
uploaded_by UUID REFERENCES users(id),
upload_stage TEXT, -- 'initial', 'progress', 'completion'
created_at TIMESTAMP DEFAULT NOW()
);

-- Vendor Quotes
CREATE TABLE maintenance_quotes (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
request_id UUID REFERENCES maintenance_requests(id),
vendor_id UUID REFERENCES users(id),

-- Response
can_respond BOOLEAN,
response_time TEXT, -- 'same_day', '24hrs', 'within_week', etc.
site_visit_required BOOLEAN,

-- Pricing
price_range TEXT, -- '0-1500', '1500-2500', etc.
estimated_amount DECIMAL(10,2),

-- Details
notes TEXT,
status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')),

created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- Purchase Orders
CREATE TABLE purchase_orders (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
po_number TEXT UNIQUE NOT NULL, -- Auto-generated PO-XXXXX
request_id UUID REFERENCES maintenance_requests(id),
landlord_id UUID REFERENCES users(id),

-- Amount
total_amount DECIMAL(10,2),
paid_amount DECIMAL(10,2) DEFAULT 0,

-- Status
status TEXT CHECK (status IN ('issued', 'in_progress', 'completed', 'paid')),

-- Timestamps
issued_at TIMESTAMP DEFAULT NOW(),
completed_at TIMESTAMP,
paid_at TIMESTAMP,

created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- PO Vendors (Many-to-many)
CREATE TABLE po_vendors (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
po_id UUID REFERENCES purchase_orders(id),
vendor_id UUID REFERENCES users(id),
amount DECIMAL(10,2),
created_at TIMESTAMP DEFAULT NOW()
);

-- Maintenance Schedule
CREATE TABLE maintenance_schedules (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
request_id UUID REFERENCES maintenance_requests(id),
vendor_id UUID REFERENCES users(id),

-- Time slots
proposed_slots JSONB, -- Array of time slots from tenant
selected_slot TIMESTAMP,
confirmed BOOLEAN DEFAULT FALSE,

created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- Maintenance Invoices
CREATE TABLE maintenance_invoices (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
request_id UUID REFERENCES maintenance_requests(id),
po_id UUID REFERENCES purchase_orders(id),
vendor_id UUID REFERENCES users(id),

-- Costs
call_out_fee DECIMAL(10,2),
labour_hours DECIMAL(5,2),
labour_rate DECIMAL(10,2),
materials_cost DECIMAL(10,2),
transport_cost DECIMAL(10,2),
admin_cost DECIMAL(10,2),
other_costs DECIMAL(10,2),
other_costs_description TEXT,

-- Total
subtotal DECIMAL(10,2),
vat DECIMAL(10,2),
total_amount DECIMAL(10,2),

-- Payment
paid BOOLEAN DEFAULT FALSE,
paid_at TIMESTAMP,
payment_method TEXT,

created_at TIMESTAMP DEFAULT NOW()
);

-- Work Reports
CREATE TABLE maintenance_reports (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
request_id UUID REFERENCES maintenance_requests(id),
vendor_id UUID REFERENCES users(id),

-- Report Details
problem_description TEXT,
work_done TEXT,
testing_validation TEXT,
manhours_used DECIMAL(5,2),
materials_used TEXT,

-- Assessment
assessment_stage TEXT, -- 'immediate', 'same_day', 'extended'

created_at TIMESTAMP DEFAULT NOW()
);

-- Planned Maintenance
CREATE TABLE planned_maintenance (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
property_id UUID REFERENCES properties(id),

-- Schedule
category TEXT, -- 'pest_control', 'aircon', 'gutter', etc.
frequency TEXT, -- 'monthly', 'quarterly', 'yearly'
next_due_date DATE,
last_completed_date DATE,

-- Reminders
reminder_days_before INTEGER DEFAULT 7,
auto_create_request BOOLEAN DEFAULT FALSE,

created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

text

---

## 📱 SCREENS TO BUILD

### **1. Report Maintenance Screen**
**File:** `src/features/maintenance/screens/ReportMaintenanceScreen.tsx`

**Features:**
- Photo/video upload (up to 10 files)
- Title & description fields
- Location picker (dropdown of rooms)
- Priority selector (Low/Medium/High)
- Category selector (Plumbing, Electrical, etc.)
- Submit button with loading state

**UI Components:**
- ImagePickerGrid (reusable from properties)
- PrioritySelector (3 chips)
- LocationDropdown
- CategoryDropdown

---

### **2. Maintenance List Screen**
**File:** `src/features/maintenance/screens/MaintenanceListScreen.tsx`

**Features:**
- List of all maintenance requests
- Filter by status (Open/In Progress/Completed)
- Filter by priority
- Search by request number
- Status badges with colors
- Pull-to-refresh

**UI Components:**
- MaintenanceCard (shows: number, title, status, priority, date)
- FilterChips
- StatusBadge

---

### **3. Maintenance Detail Screen**
**File:** `src/features/maintenance/screens/MaintenanceDetailScreen.tsx`

**Features:**
- Request details (number, date, priority)
- Photo/video gallery
- Status timeline (visual progress)
- Action buttons (based on user role & status)
- Comments/notes section
- Vendor quotes (if any)
- PO details (if issued)
- Invoice (if completed)

**UI Components:**
- MaintenanceTimeline
- PhotoGallery
- VendorQuoteCard
- ActionButtons

---

### **4. Vendor Selection Screen**
**File:** `src/features/maintenance/screens/VendorSelectionScreen.tsx`

**Features:**
- List of available vendors
- Select multiple vendors
- Push notification method (WhatsApp/SMS/Email)
- Send button

---

### **5. PO Screen**
**File:** `src/features/maintenance/screens/PurchaseOrderScreen.tsx`

**Features:**
- Auto-generated PO number
- Linked request details
- Vendor(s) assigned
- Amount breakdown
- PDF generation
- Status tracking

---

## 🎨 REUSABLE COMPONENTS

### **StatusBadge Component**
interface StatusBadgeProps {
status: 'open' | 'acknowledged' | 'in_progress' | 'completed' | 'closed';
}

const STATUS_COLORS = {
open: { bg: '#fef3c7', text: '#92400e' },
acknowledged: { bg: '#dbeafe', text: '#1e40af' },
in_progress: { bg: '#fef3c7', text: '#92400e' },
completed: { bg: '#d1fae5', text: '#065f46' },
closed: { bg: '#f1f5f9', text: '#475569' },
};

text

### **PriorityIndicator Component**
interface PriorityIndicatorProps {
priority: 'low' | 'medium' | 'high';
}

const PRIORITY_COLORS = {
low: { bg: '#d1fae5', text: '#065f46' },
medium: { bg: '#fef3c7', text: '#92400e' },
high: { bg: '#fee2e2', text: '#991b1b' },
};

text

### **MaintenanceTimeline Component**
Visual timeline showing:
- Reported → Acknowledged → Quoted → Scheduled → In Progress → Completed → Closed

---

## 🔄 USER FLOWS

### **Tenant Flow:**
1. Open app → Go to "Maintenance" tab
2. Tap "+ Report Issue"
3. Upload photos → Fill form → Submit
4. Get notification number (MNT-00001)
5. Track status in app
6. Get notified when vendor is assigned
7. Select appointment time
8. Get notified when work is done
9. View invoice & payment status

### **Landlord Flow:**
1. Get push notification of new request
2. Open app → View request details
3. Review photos & description
4. Tap "Push to Vendors"
5. Select vendors from list
6. Choose notification method
7. Wait for vendor quotes
8. Review quotes & select vendor
9. Issue PO (auto-generated)
10. Track work progress
11. Approve invoice & payment

### **Vendor Flow:**
1. Receive notification (WhatsApp/SMS/Email)
2. Open link → View request details
3. Submit quote (Yes/No, pricing, timeline)
4. If selected → Receive PO
5. Schedule appointment with tenant
6. Complete work → Upload progress photos
7. Submit completion report
8. Submit invoice
9. Receive payment notification

---

## ⏱️ TODAY'S SCHEDULE

**10:00 AM - 11:00 AM:** Database schema design & Supabase setup  
**11:00 AM - 12:30 PM:** Build Report Maintenance Screen  
**12:30 PM - 1:30 PM:** Build Maintenance List Screen  
**1:30 PM - 2:30 PM:** Lunch Break  
**2:30 PM - 3:30 PM:** Build Maintenance Detail Screen  
**3:30 PM - 4:30 PM:** Status tracking & timeline component  
**4:30 PM - 5:30 PM:** Backend integration & testing  

---

## ✅ DELIVERABLES TODAY

- [x] Complete maintenance request workflow (Tenant → Landlord)
- [x] Photo/video upload functionality
- [x] Status tracking system
- [x] Real-time notifications
- [x] Supabase backend connected
- [x] Auto-generated request numbers
- [x] Priority & category system

---

## 🚀 TOMORROW'S PLAN (Day 3)

- Vendor selection & quotes
- PO generation system
- Scheduling calendar
- Work progress updates
- Invoice & payment flow

---

## 📝 NOTES

- Use React Native Reanimated for smooth animations
- Implement haptic feedback for all actions
- Ensure offline support (queue uploads)
- Add pull-to-refresh on all lists
- Use optimistic UI updates
- Implement proper error handling

---

**LET'S BUILD! 💪🚀**

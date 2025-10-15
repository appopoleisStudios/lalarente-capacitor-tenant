# 📐 LALARENTE ARCHITECTURE GUIDE (LOCKED)

**Date:** October 15, 2025  
**Status:** FINAL - DO NOT CHANGE  
**Version:** 2.0

---

## 🎯 ARCHITECTURE PHILOSOPHY

### HYBRID ARCHITECTURE:
- **Data Layer** = Feature-Based (shared across roles)
- **UI Layer** = Role-Based (different screens per role)

### Why?
- Same data (`maintenance_requests` table)
- Different UI designs for Owner, Tenant, Vendor
- Reusable components with role-specific props

---

## 📱 EXPO ROUTER STRUCTURE (app/ directory)

### ✅ HOW TABS WORK IN EXPO ROUTER

```typescript
app/(owner)/              # Tab Group
├── _layout.tsx           # Tabs Navigator Config
├── dashboard.tsx         # Tab 1 (shown in tab bar)
├── properties.tsx        # Tab 2 (shown in tab bar)
├── maintenance.tsx       # Tab 3 (shown in tab bar)
├── tenants.tsx           # Tab 4 (shown in tab bar)
├── profile.tsx           # Tab 5 (shown in tab bar)
│
├── add-property.tsx      # Modal (href: null - NOT shown in tabs)
│
└── maintenance/          # Detail screens (NOT tabs!)
    ├── [id].tsx          # Detail view (href: null)
    └── new.tsx           # Create new (href: null)
```

### 🔑 KEY RULES FOR TABS:
1. **Tab screens** = Direct children of `(owner)/`
2. **Detail screens** = In subfolders (`maintenance/`, `properties/`)
3. Mark detail screens with `href: null` in `_layout.tsx`
4. Tabs AUTOMATICALLY persist when navigating to detail screens!

```typescript
// app/(owner)/_layout.tsx
<Tabs>
  {/* Shown in tab bar */}
  <Tabs.Screen name="maintenance" options={{ title: 'Maintenance' }} />
  
  {/* Hidden from tab bar */}
  <Tabs.Screen name="maintenance/[id]" options={{ href: null }} />
  <Tabs.Screen name="maintenance/new" options={{ href: null }} />
</Tabs>
```

### ✅ NAVIGATION IN SCREENS:

```typescript
// From MaintenanceListScreen → Detail
router.push('/(owner)/maintenance/[id]', { id: '123' });

// From Detail → New
router.push('/(owner)/maintenance/new');

// Bottom tabs STAY VISIBLE because all routes are in (owner) group!
```

---

## 🏗️ FEATURE DIRECTORY STRUCTURE (src/features/)

### PATTERN: Feature-Based Data + Role-Based UI

```
src/features/
├── maintenance/                    # ← FEATURE (Shared Logic)
│   ├── api/                        # ✅ Shared by ALL roles
│   │   ├── maintenanceApi.ts       # CRUD operations
│   │   ├── quotesApi.ts            # Vendor quotes
│   │   └── index.ts
│   ├── hooks/                      # ✅ Shared by ALL roles
│   │   ├── useMaintenanceRequests.ts  # Role-aware data fetching
│   │   ├── usePhotoUpload.ts
│   │   └── index.ts
│   ├── components/                 # ✅ Shared widgets
│   │   ├── MaintenanceCard.tsx     # Accepts role-specific props
│   │   ├── StatusBadge.tsx
│   │   ├── PriorityIndicator.tsx
│   │   └── index.ts
│   └── types/
│       └── maintenance.types.ts
│
├── owner/                          # ← ROLE (Owner-Specific UI)
│   ├── screens/
│   │   ├── OwnerDashboardScreen.tsx         # Owner analytics
│   │   ├── OwnerMaintenanceListScreen.tsx   # Owner view of maintenance
│   │   ├── PropertiesListScreen.tsx
│   │   ├── AddPropertyScreen.tsx
│   │   ├── TenantsScreen.tsx                # Managing tenants
│   │   └── ProfileScreen.tsx
│   └── components/
│       ├── PortfolioCard.tsx               # Owner-only
│       ├── AnalyticsGrid.tsx               # Owner-only
│       ├── MaintenanceSection.tsx          # Owner dashboard widget
│       └── PropertyCard.tsx
│
├── tenant/                         # ← ROLE (Tenant-Specific UI)
│   ├── screens/
│   │   ├── TenantDashboardScreen.tsx
│   │   ├── TenantMaintenanceListScreen.tsx  # Tenant view of maintenance
│   │   └── TenantProfileScreen.tsx
│   └── components/
│       └── RentPaymentCard.tsx             # Tenant-only
│
└── vendor/                         # ← ROLE (Vendor-Specific UI)
    ├── screens/
    │   ├── VendorDashboardScreen.tsx
    │   ├── VendorJobsListScreen.tsx        # Vendor view of maintenance
    │   └── EarningsScreen.tsx
    └── components/
        └── JobCard.tsx                     # Vendor-only
```

---

## 🎯 DECISION TREE: Where Does X Go?

```
┌─ Creating a new screen/component?
│
├─ Is it DATA LOGIC (API, hooks, types)?
│  └─ YES → Put in features/{workflow}/
│           Example: maintenanceApi.ts → features/maintenance/api/
│
├─ Is it a REUSABLE WIDGET (card, badge, list)?
│  └─ YES → Put in features/{workflow}/components/
│           Example: MaintenanceCard → features/maintenance/components/
│
└─ Is it a SCREEN with role-specific DESIGN?
   └─ YES → Put in features/{role}/screens/
            Example: OwnerMaintenanceListScreen → features/owner/screens/
```

---

## 📝 REAL-WORLD EXAMPLE: Maintenance List

### 1. Shared Data Hook (features/maintenance/hooks/)

```typescript
// features/maintenance/hooks/useMaintenanceRequests.ts
import { useAuth } from '@/contexts/AuthContext';
import { maintenanceApi } from '../api';

export function useMaintenanceRequests() {
  const { profile } = useAuth();
  
  // ✅ Same hook, different filters per role
  const query = {
    ...(profile?.role === 'owner' && { owner_id: profile.id }),
    ...(profile?.role === 'tenant' && { tenant_id: profile.id }),
    ...(profile?.role === 'vendor' && { selected_vendor_id: profile.id }),
  };
  
  return useQuery(['maintenance', profile?.id], () => 
    maintenanceApi.getMaintenanceRequests(query)
  );
}
```

### 2. Shared Widget (features/maintenance/components/)

```typescript
// features/maintenance/components/MaintenanceCard.tsx
interface MaintenanceCardProps {
  request: MaintenanceRequest;
  showPropertyName?: boolean;  // Owner sees this
  showTenantInfo?: boolean;    // Owner sees this
  showEarnings?: boolean;      // Vendor sees this
  actions?: string[];          // Different per role
  onPress: () => void;
}

export function MaintenanceCard(props: MaintenanceCardProps) {
  return (
    <Card>
      <StatusBadge status={props.request.status} />
      {props.showPropertyName && <Text>{props.request.property.name}</Text>}
      {props.showTenantInfo && <Text>{props.request.tenant.name}</Text>}
      {props.showEarnings && <Text>${props.request.total_amount}</Text>}
      {/* ... */}
    </Card>
  );
}
```

### 3. Owner Screen (features/owner/screens/)

```typescript
// features/owner/screens/OwnerMaintenanceListScreen.tsx
import { useMaintenanceRequests } from '@/features/maintenance/hooks';
import { MaintenanceCard } from '@/features/maintenance/components';
import { AnalyticsGrid } from '../components'; // Owner-specific

export default function OwnerMaintenanceListScreen() {
  const { requests } = useMaintenanceRequests(); // ✅ Gets owner's requests
  
  return (
    <Screen>
      <AnalyticsGrid data={requests} />  {/* Owner-only component */}
      
      <FlatList
        data={requests}
        renderItem={({ item }) => (
          <MaintenanceCard
            request={item}
            showPropertyName={true}   {/* Owner config */}
            showTenantInfo={true}     {/* Owner config */}
            actions={['acknowledge', 'push-vendors']}
            onPress={() => router.push(`/(owner)/maintenance/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}
```

### 4. Tenant Screen (features/tenant/screens/)

```typescript
// features/tenant/screens/TenantMaintenanceListScreen.tsx
import { useMaintenanceRequests } from '@/features/maintenance/hooks';
import { MaintenanceCard } from '@/features/maintenance/components';

export default function TenantMaintenanceListScreen() {
  const { requests } = useMaintenanceRequests(); // ✅ Gets tenant's requests
  
  return (
    <Screen>
      <Button onPress={reportIssue}>Report Issue</Button>
      
      <FlatList
        data={requests}
        renderItem={({ item }) => (
          <MaintenanceCard
            request={item}
            showPropertyName={false}  {/* Tenant config */}
            showTenantInfo={false}    {/* Tenant config */}
            actions={['view', 'add-photos']}
            onPress={() => router.push(`/(tenant)/maintenance/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}
```

---

## ✅ CURRENT STATUS

```
app/(owner)/
├── _layout.tsx              ✅ Working
├── dashboard.tsx            ✅ Working
├── properties.tsx           ✅ Working
├── maintenance.tsx          ✅ Working (tab screen)
├── tenants.tsx              ✅ Working
├── profile.tsx              ✅ Working
└── add-property.tsx         ✅ Working

src/features/
├── maintenance/
│   ├── api/                 ✅ Complete (maintenanceApi, quotesApi)
│   ├── hooks/               🚧 Building
│   ├── components/          ✅ Partial (3 components)
│   └── screens/             🚧 Building (2 screens)
├── owner/
│   ├── screens/             ✅ Complete (5 screens)
│   └── components/          ✅ Complete (9 components)
└── tenant/                  📝 Not started
```

---

## 🔧 SMALL FIX NEEDED

### Issue: Screen naming confusion

```bash
# Current (confusing):
src/features/maintenance/screens/MaintenanceListScreen.tsx
# Used by: app/(owner)/maintenance.tsx

# Fix (explicit):
mv src/features/maintenance/screens/MaintenanceListScreen.tsx \
   src/features/owner/screens/OwnerMaintenanceListScreen.tsx

# Update route:
# app/(owner)/maintenance.tsx
export { default } from '@/src/features/owner/screens/OwnerMaintenanceListScreen';
```

### Why?
- ✅ Clear naming: "Owner" in filename = owner-specific design
- ✅ Keeps shared logic in `maintenance/` (api, hooks, components)
- ✅ Prepares for `TenantMaintenanceListScreen`, `VendorJobsListScreen`

---

## 🚫 WHAT NOT TO DO

### ❌ DON'T: Create nested route groups

```bash
# WRONG:
app/(owner)/(maintenance)/index.tsx
app/(owner)/(properties)/index.tsx
```

### ❌ DON'T: Put role-specific screens in feature folders

```bash
# WRONG:
src/features/maintenance/screens/OwnerMaintenanceListScreen.tsx  # Owner-specific design
```

### ❌ DON'T: Duplicate API/hooks per role

```bash
# WRONG:
src/features/owner/api/maintenanceApi.ts     # ❌ Duplication!
src/features/tenant/api/maintenanceApi.ts    # ❌ Duplication!
```

---

## ✅ WHAT TO DO

### ✅ Keep routing simple

```bash
app/(owner)/maintenance.tsx      # Tab screen
app/(owner)/maintenance/[id].tsx # Detail (auto-hides tabs)
```

### ✅ Share data logic

```bash
src/features/maintenance/api/maintenanceApi.ts    # ✅ One source
src/features/maintenance/hooks/useMaintenanceRequests.ts  # ✅ Role-aware
```

### ✅ Separate UI designs

```bash
src/features/owner/screens/OwnerMaintenanceListScreen.tsx
src/features/tenant/screens/TenantMaintenanceListScreen.tsx
src/features/vendor/screens/VendorJobsListScreen.tsx
```

---

## 🎯 SUMMARY

### HYBRID ARCHITECTURE:
- **Data/Logic** → `features/{workflow}/` (shared)
- **UI/Screens** → `features/{role}/` (role-specific)
- **Routing** → `app/(role)/` (simple, no nesting)
- **Tabs persist automatically** in Expo Router

---

## 🔒 NO MORE CHANGES TO ARCHITECTURE!

**Use this document for ALL future development.**  
**Attach to every new thread!**

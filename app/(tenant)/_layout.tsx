import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';

export default function TenantLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.role.tenant.primary, // RSA Green - Tenant primary
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: {
          backgroundColor: colors.background.default,
          borderTopWidth: 1,
          borderTopColor: colors.border.default,
          height: 85,
          paddingBottom: 25,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null, // Hidden
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarButtonTestID: 'tab-home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarButtonTestID: 'tab-search',
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
        }}
      />
      {/* Lease screen - NOT in bottom navbar, accessed from dashboard */}
      <Tabs.Screen
        name="lease"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          tabBarButtonTestID: 'tab-payments',
          tabBarIcon: ({ color, size }) => <Ionicons name="card" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarButtonTestID: 'tab-profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai-chat"
        options={{
          title: 'Lala AI',
          tabBarButtonTestID: 'tab-lala-ai',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="properties/[id]"
        options={{
          href: null, // Hidden from tabs - property detail screen
        }}
      />
      <Tabs.Screen
        name="properties/[id]/view3d"
        options={{
          href: null, // Hidden from tabs - fullscreen 3D tour viewer
          // Immersive: hide the tab bar while the 3D viewer is focused (SA #152).
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="apply/[propertyId]"
        options={{
          href: null, // Hidden from tabs - application form
        }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{
          href: null, // Hidden from tabs - accessed from dashboard
        }}
      />
      <Tabs.Screen
        name="maintenance/report"
        options={{
          href: null, // Hidden from tabs - report new maintenance issue
        }}
      />
      <Tabs.Screen
        name="maintenance/[id]"
        options={{
          href: null, // Hidden from tabs - maintenance detail screen
        }}
      />
      <Tabs.Screen
        name="maintenance/[id]/invoice"
        options={{
          href: null, // Hidden from tabs - tenant invoice approve/reject (Plane #109)
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          href: null, // Hidden from tabs - accessed from dashboard
        }}
      />
      <Tabs.Screen
        name="messages/[id]"
        options={{
          href: null, // Hidden from tabs - message thread screen
        }}
      />
      <Tabs.Screen
        name="messages/new"
        options={{
          href: null, // Hidden from tabs - compose new message
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          href: null, // Hidden from tabs - accessed from dashboard
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          href: null, // Hidden from tabs - inspections + maintenance verification
        }}
      />
      <Tabs.Screen
        name="maintenance/vendor-marketplace"
        options={{
          href: null, // Hidden from tabs — tenant browses vendors for maintenance
        }}
      />
      <Tabs.Screen
        name="maintenance/verify"
        options={{
          href: null, // Hidden from tabs - tenant verifies maintenance closure
        }}
      />
      <Tabs.Screen
        name="maintenance/mediation"
        options={{
          href: null, // Hidden from tabs — closure dispute thread (Plane #103)
        }}
      />
      <Tabs.Screen
        name="maintenance/closure-confirm"
        options={{
          href: null, // Hidden from tabs - tenant confirms completed work with photos
        }}
      />
      <Tabs.Screen
        name="applications/[id]"
        options={{
          href: null, // Hidden from tabs - application detail screen
        }}
      />
      <Tabs.Screen
        name="viewings"
        options={{
          href: null, // Hidden from tabs - viewing requests list
        }}
      />
      <Tabs.Screen
        name="viewings/request"
        options={{
          href: null, // Hidden from tabs - request viewing screen
        }}
      />
      <Tabs.Screen
        name="viewings/[id]"
        options={{
          href: null, // Hidden from tabs - viewing detail screen
        }}
      />
      <Tabs.Screen
        name="lease-journey"
        options={{
          href: null, // Hidden from tabs - accessed from dashboard lease card
        }}
      />
      <Tabs.Screen
        name="payment-disputes"
        options={{
          href: null, // Hidden from tabs - accessed from payments
        }}
      />
      <Tabs.Screen
        name="early-termination"
        options={{
          href: null, // Hidden from tabs - accessed from lease detail
        }}
      />
      <Tabs.Screen
        name="deposit"
        options={{
          href: null, // Hidden from tabs - accessed from dashboard
        }}
      />
      <Tabs.Screen
        name="lease-renewal"
        options={{
          href: null, // Hidden from tabs - accessed from dashboard/lease
        }}
      />
      <Tabs.Screen
        name="privacy"
        options={{
          href: null, // Hidden from tabs - accessed from profile/settings
        }}
      />
      <Tabs.Screen
        name="privacy/data-rights"
        options={{
          href: null, // Hidden from tabs - DSAR screen
        }}
      />
      <Tabs.Screen
        name="holding-deposit"
        options={{
          href: null, // Hidden from tabs - accessed from applications/search
        }}
      />
      <Tabs.Screen
        name="application-status"
        options={{
          href: null, // Hidden from tabs - accessed from dashboard
        }}
      />
      <Tabs.Screen
        name="arrears"
        options={{
          href: null, // Hidden from tabs - accessed from payments or dashboard
        }}
      />
      <Tabs.Screen
        name="inspections/[id]"
        options={{
          href: null, // Hidden from tabs - inspection detail (sign off)
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null, // Hidden from tabs - notification list from bell icon
        }}
      />
      {/* ⚠️⚠️ VENDOR PAYMENTS MUST STAY HIDDEN FROM THE TAB BAR ⚠️⚠️
          ROOT CAUSE (fixed Aug 12): this block declared name="vendor-payments",
          but there is NO route file vendor-payments.tsx — the real route is
          vendor-payments/index.tsx. An undeclared route in a directory is
          AUTO-REGISTERED as a visible tab by expo-router (label = raw route
          name, no testID), which is why the tab survived every previous
          re-hide (commits ad7dfe3 / eb19049) and why the old guard passed
          vacuously. The name MUST match the route file exactly:
          "vendor-payments/index".
          DO NOT add a title/tabBarIcon here — the money entry lives in the
          Payments screen Money hub (Plane #82). The Maestro guard
          .maestro/flows/tenant-tabbar-guard.yaml fails the suite if any
          vendor-payments route becomes a visible tab again. */}
      <Tabs.Screen
        name="vendor-payments/index"
        options={{
          href: null, // Hidden from tabs - accessed from Payments Money hub
        }}
      />
      <Tabs.Screen
        name="vendor-payments/checkout"
        options={{
          href: null, // Hidden from tabs - in-app WebView checkout screen
        }}
      />
      <Tabs.Screen
        name="vendor-payments/[invoiceId]"
        options={{
          href: null, // Hidden from tabs - pay invoice screen
        }}
      />
      <Tabs.Screen
        name="vendor-payments/result"
        options={{
          href: null, // Hidden from tabs - payment result after PayFast
        }}
      />
    </Tabs>
  );
}

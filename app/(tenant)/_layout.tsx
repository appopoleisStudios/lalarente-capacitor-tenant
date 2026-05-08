import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';

export default function TenantLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.rsa.blue,
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
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
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
          tabBarIcon: ({ color, size }) => <Ionicons name="card" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="properties/[id]"
        options={{
          href: null, // Hidden from tabs - property detail screen
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
        name="documents/upload"
        options={{
          href: null, // Hidden from tabs - document upload screen
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          href: null, // Hidden from tabs - inspections + maintenance verification
        }}
      />
      <Tabs.Screen
        name="maintenance/verify"
        options={{
          href: null, // Hidden from tabs - tenant verifies maintenance closure
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
      <Tabs.Screen
        name="agent-chat"
        options={{
          href: null, // Hidden from tabs - accessed via floating button only
        }}
      />
     </Tabs>
  );
}

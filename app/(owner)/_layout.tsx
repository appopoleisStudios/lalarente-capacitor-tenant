import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function OwnerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.rsa.blue, // RSA Blue - Primary brand color
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
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: 'Properties',
          tabBarIcon: ({ color, size }) => <Ionicons name="business" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{
          title: 'Maintenance',
          tabBarIcon: ({ color, size }) => <Ionicons name="construct" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tenants"
        options={{
          title: 'Tenants',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
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
        name="ai-chat"
        options={{
          title: 'Lala AI',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add-property"
        options={{
          href: null, // Hidden from tabs - accessed as modal
        }}
      />
      <Tabs.Screen
        name="properties/[id]"
        options={{
          href: null, // Hidden from tabs - property detail screen
        }}
      />
      <Tabs.Screen
        name="properties/[id]/edit"
        options={{
          href: null, // Hidden from tabs - edit property screen
        }}
      />
      <Tabs.Screen
        name="maintenance/new"
        options={{
          href: null, // Hidden from tabs - detail screen
        }}
      />
      <Tabs.Screen
        name="maintenance/[id]"
        options={{
          href: null, // Hidden from tabs - detail screen
        }}
      />
      <Tabs.Screen
        name="maintenance/[id]/quote/[quoteId]"
        options={{
          href: null, // Hidden from tabs - quote detail screen
        }}
      />
      <Tabs.Screen
        name="maintenance/[id]/po/[poId]"
        options={{
          href: null, // Hidden from tabs - PO detail screen
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          href: null, // Hidden from tabs - accessed from dashboard
        }}
      />
      <Tabs.Screen
        name="applications/[id]"
        options={{
          href: null, // Hidden from tabs - application detail screen
        }}
      />
      <Tabs.Screen
        name="rent-roll"
        options={{
          href: null, // Hidden from tabs - accessed from dashboard
        }}
      />
      <Tabs.Screen
        name="leases/[id]"
        options={{
          href: null, // Hidden from tabs - lease detail screen
        }}
      />
      <Tabs.Screen
        name="leases/create"
        options={{
          href: null, // Hidden from tabs - lease creation screen
        }}
      />
      <Tabs.Screen
        name="viewings"
        options={{
          href: null, // Hidden from tabs - viewing requests list
        }}
      />
      <Tabs.Screen
        name="viewings/[id]"
        options={{
          href: null, // Hidden from tabs - viewing detail screen
        }}
      />
      <Tabs.Screen
        name="arrears"
        options={{
          href: null, // Hidden from tabs - accessed from dashboard
        }}
      />
      <Tabs.Screen
        name="renewals"
        options={{
          href: null, // Hidden from tabs - accessed from dashboard
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
        name="deposits"
        options={{
          href: null, // Hidden from tabs - accessed from dashboard
        }}
      />
      <Tabs.Screen
        name="insurance"
        options={{
          href: null, // Hidden from tabs - accessed from dashboard
        }}
      />
      <Tabs.Screen
        name="insurance/new"
        options={{
          href: null, // Hidden from tabs - create new claim
        }}
      />
      <Tabs.Screen
        name="insurance/[id]"
        options={{
          href: null, // Hidden from tabs - view claim detail
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          href: null, // Hidden from tabs - accessed from Documents section
        }}
      />
      <Tabs.Screen
        name="tax-reports"
        options={{
          href: null, // Hidden from tabs - accessed from Documents section
        }}
      />
      <Tabs.Screen
        name="compliance"
        options={{
          href: null, // Hidden from tabs - accessed from Documents section
        }}
      />
      <Tabs.Screen
        name="holding-deposit"
        options={{
          href: null, // Hidden from tabs - accessed from applications/properties
        }}
      />
      <Tabs.Screen
        name="application-competition"
        options={{
          href: null, // Hidden from tabs - accessed from property detail / applications
        }}
      />
      <Tabs.Screen
        name="early-termination"
        options={{
          href: null, // Hidden from tabs - accessed from tenant dashboard / notifications
        }}
      />
      <Tabs.Screen
        name="payment-disputes"
        options={{
          href: null, // Hidden from tabs - accessed from dashboard / rent-roll
        }}
      />
      <Tabs.Screen
        name="maintenance/send-po"
        options={{
          href: null, // Hidden from tabs - send PO to vendor
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          href: null, // Hidden from tabs - accessed from dashboard "See All"
        }}
      />
      <Tabs.Screen
        name="documents/[id]"
        options={{
          href: null, // Hidden from tabs - document viewer
        }}
      />
      <Tabs.Screen
        name="inspections"
        options={{
          href: null, // Hidden from tabs - inspections list
        }}
      />
      <Tabs.Screen
        name="inspections/new"
        options={{
          href: null, // Hidden from tabs - schedule inspection
        }}
      />
      <Tabs.Screen
        name="inspections/[id]"
        options={{
          href: null, // Hidden from tabs - inspection detail
        }}
      />
      <Tabs.Screen
        name="statements"
        options={{
          href: null, // Hidden from tabs - monthly owner statement
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null, // Hidden from tabs - notification list from bell icon
        }}
      />
    </Tabs>
  );
}

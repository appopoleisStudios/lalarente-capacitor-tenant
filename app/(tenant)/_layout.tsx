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
        name="messages"
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
    </Tabs>
  );
}

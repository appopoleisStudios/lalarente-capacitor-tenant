import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';

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
    </Tabs>
  );
}

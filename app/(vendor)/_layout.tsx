import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';

export default function VendorLayout() {
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
          href: null, // Hidden - redirects to dashboard
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
        name="maintenance"
        options={{
          title: 'Requests',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="jobs/index"
        options={{
          title: 'My Jobs',
          tabBarIcon: ({ color, size }) => <Ionicons name="hammer" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="contracts/index"
        options={{
          title: 'Contracts',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="maintenance/[id]"
        options={{
          href: null, // Hidden from tabs - detail screen
        }}
      />
      <Tabs.Screen
        name="maintenance/[id]/quote/new"
        options={{
          href: null, // Hidden from tabs - quote submission screen
        }}
      />
      <Tabs.Screen
        name="maintenance/[id]/quote/edit"
        options={{
          href: null, // Hidden from tabs - quote edit screen
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
        name="profile/services"
        options={{
          href: null, // Hidden from tabs - services management screen
        }}
      />
      <Tabs.Screen
        name="profile/documents"
        options={{
          href: null, // Hidden from tabs - documents management screen
        }}
      />
      <Tabs.Screen
        name="jobs/[id]"
        options={{
          href: null, // Hidden from tabs - job detail screen
        }}
      />
    </Tabs>
  );
}

import { Redirect } from 'expo-router';

export default function TenantIndex() {
  return <Redirect href="/(tenant)/dashboard" />;
}

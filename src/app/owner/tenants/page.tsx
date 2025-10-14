import { redirect } from 'next/navigation'

export default async function OwnerTenantsRedirect() {
  redirect('/dashboard/owner/tenants')
}



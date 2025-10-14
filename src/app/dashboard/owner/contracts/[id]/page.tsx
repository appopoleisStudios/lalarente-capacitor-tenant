import { redirect } from 'next/navigation'

export default async function OwnerContractDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) {
    redirect('/dashboard/owner/contracts')
  }
  redirect(`/contracts?id=${encodeURIComponent(id)}`)
}



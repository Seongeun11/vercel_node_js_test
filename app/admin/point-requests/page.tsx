// app/admin/requests/page.tsx
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/serverAuth'
import RequestsClient from './point-requests-client'

export default async function RequestsPage() {
  const authResult = await requireRole(['captain'])

  if (!authResult.ok) {
    if (authResult.status === 401) {
      redirect('/login')
    }

    if (authResult.status === 403) {
      redirect('/forbidden')
    }

    redirect('/')
  }

  return <RequestsClient />
}
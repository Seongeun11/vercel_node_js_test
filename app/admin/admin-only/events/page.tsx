// app/admin/admin-only/events/page.tsx
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/serverAuth'
import EventsClient from './eventsClient'

export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  const auth = await requireRole(['admin'])

  if (!auth.ok) {
    if (auth.status === 401) redirect('/login')
    redirect('/forbidden')
  }

  return <EventsClient />
}
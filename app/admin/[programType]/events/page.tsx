// app/admin/admin-only/event/page.tsx
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/serverAuth'
import eventClient from './event-client'

export const dynamic = 'force-dynamic'

export default async function eventPage() {
  const auth = await requireRole(['admin'])

  if (!auth.ok) {
    if (auth.status === 401) redirect('/login')
    redirect('/forbidden')
  }

  return <eventClient />
}
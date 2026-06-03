// app/attendance/requests/page.tsx
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/serverAuth'
import MyAttendanceRequestsClient from './myAttendanceRequestsClient'

export default async function AttendanceRequestsPage() {
  const authResult = await requireRole(['trainee'])

  if (!authResult.ok) {
    if (authResult.status === 401) {
      redirect('/login')
    }

    if (authResult.status === 403) {
      redirect('/forbidden')
    }

    redirect('/')
  }

  return <MyAttendanceRequestsClient />
}
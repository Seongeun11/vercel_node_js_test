// app/attendance/my/page.tsx
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/serverAuth'
import MyAttendanceClient from './myAttendanceClient'


export default async function MyAttendancePage() {
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

  return <MyAttendanceClient />
}
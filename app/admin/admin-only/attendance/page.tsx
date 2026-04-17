// app/admin/admin_only/attendance/page.tsx
// 서버 컴포넌트
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/serverAuth'
import AttendanceClient from './AttendanceClient'

export default async function AttendancePage() {
  const authResult = await requireRole(['admin'])

  if (!authResult.ok) {
      if (authResult.status === 401) redirect('/login')
      if (authResult.status === 403) redirect('/forbidden')
      redirect('/')
    }

  return <AttendanceClient />
}
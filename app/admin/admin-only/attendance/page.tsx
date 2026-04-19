// app/admin/admin-only/attendance/page.tsx
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/serverAuth'
import AttendanceClient from './attendance-page-client'

type PageProps = {
  searchParams: Promise<{
    date?: string
  }>
}

function getTodayKST(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export default async function AttendancePage({ searchParams }: PageProps) {
  const authResult = await requireRole(['admin'])

  if (!authResult.ok) {
    if (authResult.status === 401) redirect('/login')
    if (authResult.status === 403) redirect('/forbidden')
    redirect('/')
  }

  const resolvedSearchParams = await searchParams
  const rawDate = resolvedSearchParams?.date
  const date = typeof rawDate === 'string' && rawDate ? rawDate : getTodayKST()

  return <AttendanceClient initialDate={date} />
}
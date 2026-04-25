
// app\api\admin\attendance\list\route.ts
import { NextRequest } from 'next/server'
import { getSessionProfile } from '@/lib/server-session'
import { jsonNoStore } from '@/lib/security/api-response'

type AttendanceRow = {
  id: string
  user_id: string
  full_name: string
  student_id: string
  status: 'present' | 'late' | 'absent'
  method: 'manual' | 'qr' | 'nfc'
  check_time: string | null
  date: string
}

type AttendanceListResponse = {
  items?: AttendanceRow[]
  date?: string
  error?: string
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function getTodayKST(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest): Promise<Response> {
  const session = await getSessionProfile(['admin', 'captain'])

  if (!session.ok) {
    return jsonNoStore<AttendanceListResponse>(
      { error: '인증이 필요합니다.' },
      { status: 401 }
    )
  }

  const date = request.nextUrl.searchParams.get('date')?.trim() || getTodayKST()

  if (!isValidDate(date)) {
    return jsonNoStore<AttendanceListResponse>(
      { error: '올바른 날짜 형식이 아닙니다.' },
      { status: 400 }
    )
  }

  const { data, error } = await session.supabase
    .from('attendance')
    .select(`
      id,
      user_id,
      status,
      method,
      check_time,
      date,
      profile:profiles (
        full_name,
        student_id
      )
    `)
    .eq('date', date)
    .order('check_time', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('[admin/attendance/list] query error:', error)
    return jsonNoStore<AttendanceListResponse>(
      { error: '출석 목록을 불러오지 못했습니다.' },
      { status: 500 }
    )
  }

  return jsonNoStore<AttendanceListResponse>({
    date,
    items: (data ?? []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      full_name: row.profile?.full_name ?? '',
      student_id: row.profile?.student_id ?? '',
      status: row.status,
      method: row.method,
      check_time: row.check_time,
      date: row.date,
    })),
  })
}
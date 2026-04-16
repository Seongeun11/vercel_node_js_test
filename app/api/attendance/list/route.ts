// app/api/attendance/list/route.ts
import { NextRequest } from 'next/server'
import { getSessionProfile } from '@/lib/server-session'
import { jsonNoStore } from '@/lib/security/api-response'

type AttendanceItem = {
  id: string
  date: string
  status: 'present' | 'late' | 'absent'
  method: 'manual' | 'qr' | 'nfc'
  check_time: string
  created_at: string
  updated_at: string
  event: {
    id: string
    name: string
    start_time: string
    late_threshold_min: number
  } | null
}

type AttendanceListResponse = {
  items?: AttendanceItem[]
  error?: string
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export async function GET(request: NextRequest): Promise<Response> {
  const session = await getSessionProfile(['admin', 'captain', 'trainee'])

  if (!session.ok) {
    return jsonNoStore<AttendanceListResponse>(
      { error: session.error },
      { status: session.status }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const dateFrom = searchParams.get('date_from')?.trim() || ''
  const dateTo = searchParams.get('date_to')?.trim() || ''

  if (dateFrom && !isValidDateString(dateFrom)) {
    return jsonNoStore<AttendanceListResponse>(
      { error: 'date_from 형식은 YYYY-MM-DD 이어야 합니다.' },
      { status: 400 }
    )
  }

  if (dateTo && !isValidDateString(dateTo)) {
    return jsonNoStore<AttendanceListResponse>(
      { error: 'date_to 형식은 YYYY-MM-DD 이어야 합니다.' },
      { status: 400 }
    )
  }

  let query = session.supabase
    .from('attendance')
    .select(`
      id,
      date,
      status,
      method,
      check_time,
      created_at,
      updated_at,
      event:events (
        id,
        name,
        start_time,
        late_threshold_min
      )
    `)
    .eq('user_id', session.profile.id)
    .order('date', { ascending: false })
    .order('check_time', { ascending: false })

  if (dateFrom) {
    query = query.gte('date', dateFrom)
  }

  if (dateTo) {
    query = query.lte('date', dateTo)
  }

  const { data, error } = await query

  if (error) {
    console.error('[attendance/list] query error:', error)
    return jsonNoStore<AttendanceListResponse>(
      { error: '출석 목록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }

  const items: AttendanceItem[] = (data ?? []).map((row) => ({
    id: row.id,
    date: row.date,
    status: row.status,
    method: row.method,
    check_time: row.check_time,
    created_at: row.created_at,
    updated_at: row.updated_at,
    event: Array.isArray(row.event) ? row.event[0] ?? null : row.event ?? null,
  }))

  return jsonNoStore<AttendanceListResponse>({
    items,
  })
}
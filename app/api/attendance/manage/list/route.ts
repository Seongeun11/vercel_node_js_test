// app/api/attendance/manage/list/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonNoStore } from '@/lib/security/api-response'

type AttendanceStatus = 'present' | 'late' | 'absent'
type AttendanceMethod = 'manual' | 'qr' | 'nfc'

type AttendanceManageItem = {
  id: string
  user_id: string
  event_id: string
  date: string
  status: AttendanceStatus
  method: AttendanceMethod
  check_time: string
  created_at: string
  updated_at: string
  event: {
    id: string
    name: string
    start_time: string
    late_threshold_min: number
  } | null
  user: {
    id: string
    student_id: string
    full_name: string
    role: 'admin' | 'captain' | 'trainee'
  } | null
}

type AttendanceManageListResponse = {
  items?: AttendanceManageItem[]
  error?: string
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

export async function GET(request: NextRequest): Promise<Response> {
  const authResult = await requireRole(['admin'])

  if (!authResult.ok) {
    return jsonNoStore<AttendanceManageListResponse>(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const eventId = searchParams.get('event_id')?.trim() || ''
  const userKeyword = searchParams.get('user_keyword')?.trim() || ''
  const status = searchParams.get('status')?.trim() || ''
  const dateFrom = searchParams.get('date_from')?.trim() || ''
  const dateTo = searchParams.get('date_to')?.trim() || ''
  const limit = parsePositiveInt(searchParams.get('limit'), 50, 200)

  if (dateFrom && !isValidDateString(dateFrom)) {
    return jsonNoStore<AttendanceManageListResponse>(
      { error: 'date_from 형식은 YYYY-MM-DD 이어야 합니다.' },
      { status: 400 }
    )
  }

  if (dateTo && !isValidDateString(dateTo)) {
    return jsonNoStore<AttendanceManageListResponse>(
      { error: 'date_to 형식은 YYYY-MM-DD 이어야 합니다.' },
      { status: 400 }
    )
  }

  let query = supabaseAdmin
    .from('attendance')
    .select(`
      id,
      user_id,
      event_id,
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
      ),
      user:profiles!attendance_user_id_fkey (
        id,
        student_id,
        full_name,
        role
      )
    `)
    .order('date', { ascending: false })
    .order('check_time', { ascending: false })
    .limit(limit)

  if (eventId) {
    query = query.eq('event_id', eventId)
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (dateFrom) {
    query = query.gte('date', dateFrom)
  }

  if (dateTo) {
    query = query.lte('date', dateTo)
  }

  const { data, error } = await query

  if (error) {
    console.error('[attendance/manage/list] query error:', error)
    return jsonNoStore<AttendanceManageListResponse>(
      { error: '운영용 출석 목록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }

  let items = (data ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    event_id: row.event_id,
    date: row.date,
    status: row.status,
    method: row.method,
    check_time: row.check_time,
    created_at: row.created_at,
    updated_at: row.updated_at,
    event: Array.isArray(row.event) ? row.event[0] ?? null : row.event ?? null,
    user: Array.isArray(row.user) ? row.user[0] ?? null : row.user ?? null,
  }))

  if (userKeyword) {
    const keyword = userKeyword.toLowerCase()
    items = items.filter((item) => {
      const fullName = item.user?.full_name?.toLowerCase() ?? ''
      const studentId = item.user?.student_id?.toLowerCase() ?? ''
      return fullName.includes(keyword) || studentId.includes(keyword)
    })
  }

  return jsonNoStore<AttendanceManageListResponse>({
    items,
  })
}
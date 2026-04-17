// app/api/attendance/list/route.ts
import { NextRequest } from 'next/server'
import { getSessionProfile } from '@/lib/server-session'
import { jsonNoStore } from '@/lib/security/api-response'

type AttendanceItem = {
  id: string
  user_id: string
  event_id: string
  date: string
  status: 'present' | 'late' | 'absent'
  method: 'manual' | 'qr' | 'nfc'
  check_time: string
  created_at: string
  updated_at: string
  can_request_change: boolean
  pending_request_exists: boolean
  event: {
    id: string
    name: string
    start_time: string
    late_threshold_min: number
  } | null
}

type AttendanceRow = {
  id: string
  user_id: string
  event_id: string
  date: string
  status: 'present' | 'late' | 'absent'
  method: 'manual' | 'qr' | 'nfc'
  check_time: string
  created_at: string
  updated_at: string
  event:
    | {
        id: string
        name: string
        start_time: string
        late_threshold_min: number
      }
    | {
        id: string
        name: string
        start_time: string
        late_threshold_min: number
      }[]
    | null
}

type AttendanceChangeRequestRow = {
  attendance_id: string
}

type AttendanceListResponse = {
  items?: AttendanceItem[]
  error?: string
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function canRequestChange(status: AttendanceItem['status']): boolean {
  // 현재 정책상 지각/결석 건만 변경 요청 허용
  return status === 'late' || status === 'absent'
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

  let attendanceQuery = session.supabase
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
      )
    `)
    .eq('user_id', session.profile.id)
    .order('date', { ascending: false })
    .order('check_time', { ascending: false })

  if (dateFrom) {
    attendanceQuery = attendanceQuery.gte('date', dateFrom)
  }

  if (dateTo) {
    attendanceQuery = attendanceQuery.lte('date', dateTo)
  }

  const { data, error } = await attendanceQuery

  if (error) {
    console.error('[attendance/list] query error:', error)
    return jsonNoStore<AttendanceListResponse>(
      { error: '출석 목록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }

  const attendanceRows = (data ?? []) as AttendanceRow[]
  const attendanceIds = attendanceRows.map((row) => row.id)

  let pendingRequestAttendanceIdSet = new Set<string>()

  if (attendanceIds.length > 0) {
    const { data: pendingRequests, error: pendingRequestError } =
      await session.supabase
        .from('attendance_change_requests')
        .select('attendance_id')
        .in('attendance_id', attendanceIds)
        .eq('requester_user_id', session.profile.id)
        .eq('status', 'pending')

    if (pendingRequestError) {
      console.error(
        '[attendance/list] pending request query error:',
        pendingRequestError
      )
      return jsonNoStore<AttendanceListResponse>(
        { error: '출석 변경 요청 정보 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    pendingRequestAttendanceIdSet = new Set(
      ((pendingRequests ?? []) as AttendanceChangeRequestRow[]).map(
        (row) => row.attendance_id
      )
    )
  }

  const items: AttendanceItem[] = attendanceRows.map((row) => {
    const event = Array.isArray(row.event) ? row.event[0] ?? null : row.event ?? null
    const pending_request_exists = pendingRequestAttendanceIdSet.has(row.id)

    return {
      id: row.id,
      user_id: row.user_id,
      event_id: row.event_id,
      date: row.date,
      status: row.status,
      method: row.method,
      check_time: row.check_time,
      created_at: row.created_at,
      updated_at: row.updated_at,
      can_request_change:
        canRequestChange(row.status) && !pending_request_exists,
      pending_request_exists,
      event,
    }
  })

  return jsonNoStore<AttendanceListResponse>({
    items,
  })
}
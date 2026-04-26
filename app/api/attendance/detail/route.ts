// app/api/attendance/detail/route.ts
import { NextRequest } from 'next/server'
import { getSessionProfile } from '@/lib/server-session'
import { jsonNoStore } from '@/lib/security/api-response'

type AttendanceDetailResponse = {
  item?: {
    id: string
    user_id: string
    event_id: string
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
  error?: string
}

export async function GET(request: NextRequest): Promise<Response> {
  const session = await getSessionProfile(['trainee'])

  if (!session.ok) {
    return jsonNoStore<AttendanceDetailResponse>(
      { error: '인증이 필요합니다.' },
      { status: 401 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const attendanceId = searchParams.get('id')?.trim() || ''

  if (!attendanceId) {
    return jsonNoStore<AttendanceDetailResponse>(
      { error: '출석 ID가 필요합니다.' },
      { status: 400 }
    )
  }

  const { data, error } = await session.supabase
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
    .eq('id', attendanceId)
    .eq('user_id', session.profile.id)
    .maybeSingle()

  if (error) {
    console.error('[attendance/detail] query error:', error)
    return jsonNoStore<AttendanceDetailResponse>(
      { error: '출석 상세 조회에 실패했습니다.' },
      { status: 500 }
    )
  }

  if (!data) {
    return jsonNoStore<AttendanceDetailResponse>(
      { error: '출석 정보를 찾을 수 없습니다.' },
      { status: 404 }
    )
  }

  return jsonNoStore<AttendanceDetailResponse>({
    item: {
      id: data.id,
      user_id: data.user_id,
      event_id: data.event_id,
      date: data.date,
      status: data.status,
      method: data.method,
      check_time: data.check_time,
      created_at: data.created_at,
      updated_at: data.updated_at,
      event: Array.isArray(data.event) ? data.event[0] ?? null : data.event ?? null,
    },
  })
}
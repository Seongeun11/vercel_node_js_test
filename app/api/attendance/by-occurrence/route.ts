// app/api/attendance/by-occurrence/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type AttendanceStatus = 'present' | 'late' | 'absent'

type ByOccurrenceBody = {
  occurrence_id?: string
}

type AttendanceRow = {
  id: string
  user_id: string
  event_id: string
  occurrence_id: string
  attendance_date: string | null
  date: string | null
  status: AttendanceStatus
  method: string | null
  check_time: string | null
  created_at?: string | null
  updated_at?: string | null
  profiles?: Array<{
    id: string
    full_name: string
    student_id: string
    role: 'admin' | 'captain' | 'trainee'
  }> | null
}

type AttendanceByOccurrenceResponse = {
  occurrence?: {
    id: string
    event_id: string
    occurrence_date: string
    start_time: string
    end_time: string | null
    status: string
    event: {
      id: string
      name: string
      late_threshold_min: number
      is_special_event: boolean
      recurrence_type: 'none' | 'daily'
    } | null
  }
  summary?: {
    total_checked_count: number
    present_count: number
    late_count: number
    absent_count: number
  }
  items?: Array<{
    id: string
    user_id: string
    full_name: string
    student_id: string
    role: 'admin' | 'captain' | 'trainee'
    status: AttendanceStatus
    method: string | null
    check_time: string | null
    attendance_date: string | null
  }>
  error?: string
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore<AttendanceByOccurrenceResponse>(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as ByOccurrenceBody
    const occurrenceId = String(body.occurrence_id ?? '').trim()

    if (!occurrenceId) {
      return jsonNoStore<AttendanceByOccurrenceResponse>(
        { error: '회차 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 1) 회차 존재 확인
    const { data: occurrence, error: occurrenceError } = await supabaseAdmin
      .from('event_occurrences')
      .select(`
        id,
        event_id,
        occurrence_date,
        start_time,
        end_time,
        status,
        events (
          id,
          name,
          late_threshold_min,
          is_special_event,
          recurrence_type
        )
      `)
      .eq('id', occurrenceId)
      .single()

    if (occurrenceError) {
      return jsonNoStore<AttendanceByOccurrenceResponse>(
        { error: occurrenceError.message },
        { status: 500 }
      )
    }

    if (!occurrence) {
      return jsonNoStore<AttendanceByOccurrenceResponse>(
        { error: '회차를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 2) 회차별 출석 목록 조회
    const { data: attendanceRows, error: attendanceError } = await supabaseAdmin
      .from('attendance')
      .select(`
        id,
        user_id,
        event_id,
        occurrence_id,
        attendance_date,
        date,
        status,
        method,
        check_time,
        created_at,
        updated_at,
        profiles (
          id,
          full_name,
          student_id,
          role
        )
      `)
      .eq('occurrence_id', occurrenceId)
      .order('check_time', { ascending: true })

    if (attendanceError) {
      return jsonNoStore<AttendanceByOccurrenceResponse>(
        { error: attendanceError.message },
        { status: 500 }
      )
    }

    const rows = (attendanceRows ?? []) as unknown as AttendanceRow[]

    const presentCount = rows.filter((row) => row.status === 'present').length
    const lateCount = rows.filter((row) => row.status === 'late').length
    const absentCount = rows.filter((row) => row.status === 'absent').length

    return jsonNoStore<AttendanceByOccurrenceResponse>(
      {
        occurrence: {
          id: occurrence.id,
          event_id: occurrence.event_id,
          occurrence_date: occurrence.occurrence_date,
          start_time: occurrence.start_time,
          end_time: occurrence.end_time,
          status: occurrence.status,
          event: Array.isArray(occurrence.events)
            ? occurrence.events[0] ?? null
            : occurrence.events ?? null,
        },
        summary: {
          total_checked_count: rows.length,
          present_count: presentCount,
          late_count: lateCount,
          absent_count: absentCount,
        },
        items: rows.map((row) => {
          const profile = Array.isArray(row.profiles)
            ? row.profiles[0] ?? null
            : row.profiles ?? null

          return {
            id: row.id,
            user_id: row.user_id,
            full_name: profile?.full_name ?? '알 수 없음',
            student_id: profile?.student_id ?? '-',
            role: profile?.role ?? 'trainee',
            status: row.status,
            method: row.method,
            check_time: row.check_time,
            attendance_date: row.attendance_date ?? row.date,
          }
        }),
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<AttendanceByOccurrenceResponse>(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('[attendance/by-occurrence] unexpected error:', error)
    }

    return jsonNoStore<AttendanceByOccurrenceResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
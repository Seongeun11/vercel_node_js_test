// app/api/attendance/missing-by-occurrence/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type MissingByOccurrenceBody = {
  occurrence_id?: string
}

type TraineeProfileRow = {
  id: string
  full_name: string
  student_id: string
  role: 'trainee'
  enrollment_status: 'active' | 'completed'
}

type ExistingAttendanceRow = {
  user_id: string
}

type MissingByOccurrenceResponse = {
  occurrence?: {
    id: string
    event_id: string
    occurrence_date: string
    start_time: string
    end_time: string | null
    status: 'scheduled' | 'open' | 'closed' | 'archived'
    event: {
      id: string
      name: string
      late_threshold_min: number
      is_special_event: boolean
      recurrence_type: 'none' | 'daily'
      is_active: boolean
    } | null
  }
  count?: number
  items?: Array<{
    id: string
    full_name: string
    student_id: string
    role: 'trainee'
  }>
  error?: string
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore<MissingByOccurrenceResponse>(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as MissingByOccurrenceBody
    const occurrenceId = String(body.occurrence_id ?? '').trim()

    if (!occurrenceId) {
      return jsonNoStore<MissingByOccurrenceResponse>(
        { error: '회차 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 1) 회차 조회
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
          recurrence_type,
          is_active
        )
      `)
      .eq('id', occurrenceId)
      .single()

    if (occurrenceError) {
      return jsonNoStore<MissingByOccurrenceResponse>(
        { error: occurrenceError.message },
        { status: 500 }
      )
    }

    if (!occurrence) {
      return jsonNoStore<MissingByOccurrenceResponse>(
        { error: '회차를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 2) 전체 trainee 조회
    const { data: trainees, error: traineesError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, student_id, role,enrollment_status')
      .eq('role', 'trainee')
      .eq('enrollment_status', 'active')
      .order('student_id', { ascending: true })

    if (traineesError) {
      return jsonNoStore<MissingByOccurrenceResponse>(
        { error: traineesError.message },
        { status: 500 }
      )
    }

    const traineeRows = (trainees ?? []) as TraineeProfileRow[]

    // 3) 해당 회차에 attendance가 있는 사용자 조회
    const { data: existingAttendance, error: existingAttendanceError } =
      await supabaseAdmin
        .from('attendance')
        .select('user_id')
        .eq('occurrence_id', occurrenceId)

    if (existingAttendanceError) {
      return jsonNoStore<MissingByOccurrenceResponse>(
        { error: existingAttendanceError.message },
        { status: 500 }
      )
    }

    const existingUserIds = new Set(
      ((existingAttendance ?? []) as ExistingAttendanceRow[]).map((row) => row.user_id)
    )

    // 4) attendance 없는 trainee만 필터링
    const missingItems = traineeRows
      .filter((row) => !existingUserIds.has(row.id))
      .map((row) => ({
        id: row.id,
        full_name: row.full_name,
        student_id: row.student_id,
        role: 'trainee' as const,
      }))

    const event = Array.isArray(occurrence.events)
      ? occurrence.events[0] ?? null
      : occurrence.events ?? null

    return jsonNoStore<MissingByOccurrenceResponse>(
      {
        occurrence: {
          id: occurrence.id,
          event_id: occurrence.event_id,
          occurrence_date: occurrence.occurrence_date,
          start_time: occurrence.start_time,
          end_time: occurrence.end_time,
          status: occurrence.status,
          event,
        },
        count: missingItems.length,
        items: missingItems,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<MissingByOccurrenceResponse>(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('[attendance/missing-by-occurrence] unexpected error:', error)
    }

    return jsonNoStore<MissingByOccurrenceResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
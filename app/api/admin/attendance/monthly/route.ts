// app/api/admin/attendance/monthly/route.ts

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonNoStore } from '@/lib/security/api-response'

type AttendanceStatus = 'present' | 'late' | 'absent'
type MonthlyCellStatus = AttendanceStatus | 'unmarked'

type ProfileRow = {
  id: string
  student_id: string
  full_name: string
  role: string
  cohort_no: number | null
}

type OccurrenceRow = {
  id: string
  event_id: string
  occurrence_date: string
  start_time: string
  end_time: string | null
  status: 'scheduled' | 'open' | 'closed' | 'archived'
  events:
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

type AttendanceRow = {
  id: string
  user_id: string
  event_id: string
  occurrence_id: string | null
  attendance_date: string | null
  date: string | null
  status: AttendanceStatus
  method: string | null
  check_time: string | null
}

type MonthlyOccurrence = {
  id: string
  event_id: string
  event_name: string
  occurrence_date: string
  start_time: string
  end_time: string | null
  status: OccurrenceRow['status']
}

type MonthlyAttendanceCell = {
  occurrence_id: string
  event_id: string
  event_name: string
  occurrence_date: string
  status: MonthlyCellStatus
  attendance_id: string | null
  method: string | null
  check_time: string | null
}

type MonthlyAttendanceUserRow = {
  profile_id: string
  student_id: string
  full_name: string
  cohort_no: number | null
  days: Record<string, MonthlyAttendanceCell>
}


function getJoinedEvent(event: OccurrenceRow['events']) {
  return Array.isArray(event) ? event[0] ?? null : event
}

function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
}

function getMonthRange(month: string): {
  startDate: string
  endDate: string
} {
  const startDate = `${month}-01`
  const end = new Date(`${startDate}T00:00:00.000Z`)

  end.setUTCMonth(end.getUTCMonth() + 1)

  return {
    startDate,
    endDate: end.toISOString().slice(0, 10),
  }
}

function normalizeKeyword(value: string | null): string {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeCohortNo(value: string | null): number | null {
  const text = String(value ?? '').trim()

  if (!text) return null

  const cohortNo = Number(text)

  if (!Number.isInteger(cohortNo) || cohortNo < 1) {
    return NaN
  }

  return cohortNo
}

function normalizeEventId(value: string | null): string {
  return String(value ?? '').trim()
}

function buildAttendanceKey(userId: string, occurrenceId: string): string {
  return `${userId}:${occurrenceId}`
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await requireRole(['admin'])

    if (!authResult.ok) {
      return jsonNoStore(
        { error: '인증이 필요합니다.' },
      { status: 401 }
      )
    }

    const { searchParams } = request.nextUrl

    const month = String(searchParams.get('month') ?? '').trim()
    const keyword = normalizeKeyword(searchParams.get('keyword'))
    const cohortNo = normalizeCohortNo(searchParams.get('cohort_no'))
    const eventId = normalizeEventId(searchParams.get('event_id'))

    if (!isValidMonth(month)) {
      return jsonNoStore(
        { error: 'month는 YYYY-MM 형식이어야 합니다.' },
        { status: 400 }
      )
    }

    if (Number.isNaN(cohortNo)) {
      return jsonNoStore(
        { error: 'cohort_no는 1 이상의 정수여야 합니다.' },
        { status: 400 }
      )
    }

    const { startDate, endDate } = getMonthRange(month)

    /**
     * 1. 수련생 목록 조회
     * - 월별 표의 행 기준
     * - 출석 기록이 없어도 표시되어야 하므로 profiles를 먼저 조회
     */
    let profileQuery = supabaseAdmin
      .from('profiles')
      .select('id, student_id, full_name, role, cohort_no')
      .eq('role', 'trainee')
      .order('student_id', { ascending: true })
      .limit(1000)

    if (cohortNo !== null) {
      profileQuery = profileQuery.eq('cohort_no', cohortNo)
    }

    const { data: profileData, error: profileError } = await profileQuery

    if (profileError) {
      console.error('[admin/attendance/monthly] profile query error:', profileError)

      return jsonNoStore(
        { error: '수련생 목록을 불러오지 못했습니다.' },
        { status: 500 }
      )
    }

    const profiles = ((profileData ?? []) as ProfileRow[]).filter((profile) => {
      if (!keyword) return true

      return (
        profile.student_id.toLowerCase().includes(keyword) ||
        profile.full_name.toLowerCase().includes(keyword)
      )
    })

    /**
     * 2. 월별 회차 목록 조회
     * - 월별 표의 컬럼 기준
     */
    let occurrenceQuery = supabaseAdmin
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
          start_time,
          late_threshold_min
        )
      `)
      .gte('occurrence_date', startDate)
      .lt('occurrence_date', endDate)
      .order('occurrence_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (eventId) {
      occurrenceQuery = occurrenceQuery.eq('event_id', eventId)
    }

    const { data: occurrenceData, error: occurrenceError } =
      await occurrenceQuery

    if (occurrenceError) {
      console.error(
        '[admin/attendance/monthly] occurrence query error:',
        occurrenceError
      )

      return jsonNoStore(
        { error: '월별 회차 목록을 불러오지 못했습니다.' },
        { status: 500 }
      )
    }

    const rawOccurrences = (occurrenceData ?? []) as OccurrenceRow[]

    const occurrences: MonthlyOccurrence[] = rawOccurrences.map((occurrence) => {
      const event = getJoinedEvent(occurrence.events)

      return {
        id: occurrence.id,
        event_id: occurrence.event_id,
        event_name: event?.name ?? '알 수 없는 이벤트',
        occurrence_date: occurrence.occurrence_date,
        start_time: occurrence.start_time,
        end_time: occurrence.end_time,
        status: occurrence.status,
      }
    })

    const profileIds = profiles.map((profile) => profile.id)
    const occurrenceIds = occurrences.map((occurrence) => occurrence.id)

    /**
     * 3. 출석 기록 조회
     * - profileIds/occurrenceIds가 비어 있으면 Supabase .in() 호출 생략
     */
    let attendanceRows: AttendanceRow[] = []

    if (profileIds.length > 0 && occurrenceIds.length > 0) {
      const { data: attendanceData, error: attendanceError } =
        await supabaseAdmin
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
            check_time
          `)
          .in('user_id', profileIds)
          .in('occurrence_id', occurrenceIds)

      if (attendanceError) {
        console.error(
          '[admin/attendance/monthly] attendance query error:',
          attendanceError
        )

        return jsonNoStore(
          { error: '출석 기록을 불러오지 못했습니다.' },
          { status: 500 }
        )
      }

      attendanceRows = (attendanceData ?? []) as AttendanceRow[]
    }

    const attendanceMap = new Map<string, AttendanceRow>()

    for (const attendance of attendanceRows) {
      if (!attendance.occurrence_id) continue

      attendanceMap.set(
        buildAttendanceKey(attendance.user_id, attendance.occurrence_id),
        attendance
      )
    }

    /**
     * 4. 월별 표 형태로 조립
     */
    const rows: MonthlyAttendanceUserRow[] = profiles.map((profile) => {
      const days: Record<string, MonthlyAttendanceCell> = {}

      for (const occurrence of occurrences) {
        const attendance = attendanceMap.get(
          buildAttendanceKey(profile.id, occurrence.id)
        )

        days[occurrence.id] = {
          occurrence_id: occurrence.id,
          event_id: occurrence.event_id,
          event_name: occurrence.event_name,
          occurrence_date: occurrence.occurrence_date,
          status: attendance?.status ?? 'unmarked',
          attendance_id: attendance?.id ?? null,
          method: attendance?.method ?? null,
          check_time: attendance?.check_time ?? null,
        }
      }

      return {
        profile_id: profile.id,
        student_id: profile.student_id,
        full_name: profile.full_name,
        cohort_no: profile.cohort_no,
        days,
      }
    })

    const summary = {
      trainee_count: profiles.length,
      occurrence_count: occurrences.length,
      present_count: 0,
      late_count: 0,
      absent_count: 0,
      unmarked_count: 0,
    }

    for (const row of rows) {
      for (const cell of Object.values(row.days)) {
        switch (cell.status) {
          case 'present':
            summary.present_count += 1
            break
          case 'late':
            summary.late_count += 1
            break
          case 'absent':
            summary.absent_count += 1
            break
          case 'unmarked':
            summary.unmarked_count += 1
            break
        }
      }
    }

    return jsonNoStore(
      {
        month,
        range: {
          start_date: startDate,
          end_date: endDate,
        },
        filters: {
          cohort_no: cohortNo,
          keyword,
          event_id: eventId || null,
        },
        summary,
        occurrences,
        rows,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[admin/attendance/monthly] unexpected error:', error)

    return jsonNoStore(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
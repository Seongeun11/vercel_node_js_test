// app/api/admin/attendance/monthly/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonNoStore } from '@/lib/security/api-response'

type AttendanceStatus = 'present' | 'late' | 'absent'
type MonthlyCellStatus = AttendanceStatus | 'unmarked'

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

function getMonthRange(month: string): { startDate: string; endDate: string } {
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
  if (!text || text === 'undefined') return null
  const cohortNo = Number(text)
  if (!Number.isInteger(cohortNo) || cohortNo < 1) {
    return NaN
  }
  return cohortNo
}

function normalizeEventId(value: string | null): string {
  const text = String(value ?? '').trim()
  return text === 'undefined' ? '' : text
}

function buildAttendanceKey(userId: string, occurrenceId: string): string {
  return `${userId}:${occurrenceId}`
}

/**
 * 🚀 [교정 논리]: 프론트엔드 라우트 파라미터(영문)를 실제 DB 마스터 데이터(한글)로 치환해주는 매핑 테이블 정의
 */
const PROGRAM_TYPE_MAP: Record<string, string> = {
  'academy': '아카데미',
  'spirituality': '영성 40일',
  'mosim': '모심 40일',
  'hyojinjeong': '효진정',
  'seonghwa': '성화영성',
  'gongmyeong': '3일 공명기도'
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl

    // 1. 소속 정보 파라미터 추출
    const rawProgramType = searchParams.get('program_type')
    if (!rawProgramType || rawProgramType.trim() === '' || rawProgramType === 'undefined') {
      return jsonNoStore(
        { error: '유효한 소속 정보(program_type)가 지정되지 않았습니다.' },
        { status: 400 }
      )
    }
    const programTypeKey = rawProgramType.trim().toLowerCase()
    
    // 🚀 [교정 논리]: 영문 소속 코드를 한글 실제 소속 이름으로 변환
    const dbAffiliationName = PROGRAM_TYPE_MAP[programTypeKey] ?? programTypeKey

    const month = String(searchParams.get('month') ?? '').trim()
    const keyword = normalizeKeyword(searchParams.get('keyword'))
    const cohortNo = normalizeCohortNo(searchParams.get('cohort_no'))
    const eventId = normalizeEventId(searchParams.get('event_id'))

    if (!isValidMonth(month)) {
      return jsonNoStore({ error: 'month는 YYYY-MM 형식이어야 합니다.' }, { status: 400 })
    }

    if (Number.isNaN(cohortNo)) {
      return jsonNoStore({ error: 'cohort_no는 1 이상의 정수여야 합니다.' }, { status: 400 })
    }

    const { startDate, endDate } = getMonthRange(month)

    /**
     * 2. 수련생 목록 조회
     * 🚀 [교정 논리]: 명확한 테이블 릴레이션 스키마에 근거하여 affiliations 조인 필터링 적용
     */
    let profileQuery = supabaseAdmin
      .from('profiles')
      .select(`
        id, 
        student_id, 
        full_name, 
        cohort_no, 
        enrollment_status, 
        roles!inner(name), 
        affiliations!inner(name)
      `)
      .eq('roles.name', 'trainee') // 수련생만 필터
      .eq('enrollment_status', 'active') // 활성화 상태만 필터
      .eq('affiliations.name', dbAffiliationName) // 🚀 [해결]: 매핑된 한글 소속명으로 DB 레벨에서 완벽 격리 필터링
      .order('student_id', { ascending: true })
      .limit(1000)

    if (cohortNo !== null) {
      profileQuery = profileQuery.eq('cohort_no', cohortNo)
    }

    const { data: profileData, error: profileError } = await profileQuery

    if (profileError) {
      console.error('[admin/attendance/monthly] profile query error:', profileError)
      return jsonNoStore({ error: '수련생 목록을 불러오지 못했습니다.' }, { status: 500 })
    }

    // 데이터 가공 안전 처리 및 추가 필터링(키워드 등)
    const profiles = ((profileData ?? []) as any[])
      .map(p => {
        const roleName = Array.isArray(p.roles) ? p.roles[0]?.name : p.roles?.name
        const affiliationName = Array.isArray(p.affiliations) ? p.affiliations[0]?.name : p.affiliations?.name

        return {
          id: p.id,
          student_id: p.student_id ? String(p.student_id).trim() : '',
          full_name: p.full_name ? String(p.full_name).trim() : '이름 없음',
          enrollment_status: p.enrollment_status,
          cohort_no: p.cohort_no,
          role: roleName ? String(roleName).trim().toLowerCase() : '',
          affiliation: affiliationName ? String(affiliationName).trim() : ''
        }
      })
      .filter((profile) => {
        // 검색어 필터링 적용
        if (keyword) {
          return (
            profile.student_id.toLowerCase().includes(keyword) ||
            profile.full_name.toLowerCase().includes(keyword)
          )
        }
        return true
      })

    /**
     * 3. 월별 회차 목록 조회
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

    const { data: occurrenceData, error: occurrenceError } = await occurrenceQuery

    if (occurrenceError) {
      console.error('[admin/attendance/monthly] occurrence query error:', occurrenceError)
      return jsonNoStore({ error: '월별 회차 목록을 불러오지 못했습니다.' }, { status: 500 })
    }

    const rawOccurrences = (occurrenceData ?? []) as OccurrenceRow[]
    const occurrences: MonthlyOccurrence[] = rawOccurrences.map((occurrence) => {
      const event = getJoinedEvent(occurrence.events)
      return {
        id: occurrence.id,
        event_id: occurrence.event_id,
        event_name: event?.name ?? '알 수 없는 행사',
        occurrence_date: occurrence.occurrence_date,
        start_time: occurrence.start_time,
        end_time: occurrence.end_time,
        status: occurrence.status,
      }
    })

    const profileIds = profiles.map((profile) => profile.id)
    const occurrenceIds = occurrences.map((occurrence) => occurrence.id)

    /**
     * 4. 출석 기록 조회
     */
    let attendanceRows: AttendanceRow[] = []

    if (profileIds.length > 0 && occurrenceIds.length > 0) {
      const { data: attendanceData, error: attendanceError } = await supabaseAdmin
        .from('attendance')
        .select(`
          id,
          user_id,
          event_id,
          occurrence_id,
          attendance_date,
          status,
          method,
          check_time
        `)
        .in('user_id', profileIds)
        .in('occurrence_id', occurrenceIds)

      if (attendanceError) {
        console.error('[admin/attendance/monthly] attendance query error:', attendanceError)
        return jsonNoStore({ error: '출석 기록을 불러오지 못했습니다.' }, { status: 500 })
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
     * 5. 월별 표 형태로 데이터 조립
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
          case 'present': summary.present_count += 1; break
          case 'late': summary.late_count += 1; break
          case 'absent': summary.absent_count += 1; break
          case 'unmarked': summary.unmarked_count += 1; break
        }
      }
    }

    return jsonNoStore(
      {
        month,
        range: { start_date: startDate, end_date: endDate },
        filters: {
          cohort_no: cohortNo,
          keyword,
          event_id: eventId || null,
          program_type: programTypeKey
        },
        summary,
        occurrences,
        rows,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[admin/attendance/monthly] unexpected error:', error)
    return jsonNoStore({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
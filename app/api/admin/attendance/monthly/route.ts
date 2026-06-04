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
  events: { id: string; name: string } | { id: string; name: string }[] | null
}

type AttendanceRow = {
  id: string
  user_id: string
  event_id: string
  occurrence_id: string | null
  status: AttendanceStatus
  method: string | null
  check_time: string | null
}

function getJoinedEvent(event: OccurrenceRow['events']) {
  return Array.isArray(event) ? event[0] ?? null : event
}

function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
}

function getMonthRange(month: string) {
  const startDate = `${month}-01`
  const end = new Date(`${startDate}T00:00:00.000Z`)
  end.setUTCMonth(end.getUTCMonth() + 1)
  return {
    startDate,
    endDate: end.toISOString().slice(0, 10),
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const month = String(searchParams.get('month') ?? '').trim()
    const keyword = String(searchParams.get('keyword') ?? '').trim().toLowerCase()
    
    const cohortNoRaw = searchParams.get('cohort_no')
    const cohortNo = cohortNoRaw ? Number(cohortNoRaw) : null
    
    const affiliationIdRaw = searchParams.get('affiliation_id')
    const affiliationId = affiliationIdRaw ? Number(affiliationIdRaw) : null
    
    const eventId = String(searchParams.get('event_id') ?? '').trim()

    if (!isValidMonth(month)) {
      return jsonNoStore({ error: 'month는 YYYY-MM 형식이어야 합니다.' }, { status: 400 })
    }

    const { startDate, endDate } = getMonthRange(month)

    // 1. 수련생 데이터 Left Join 연동 조회
    let profileQuery = supabaseAdmin
      .from('profiles')
      .select('id, student_id, full_name, cohort_no, affiliation_id, enrollment_status, roles!inner(name), affiliations(name)')
      .eq('roles.name', 'trainee')
      .eq('enrollment_status', 'active')
      .order('student_id', { ascending: true })

    if (cohortNo !== null && !Number.isNaN(cohortNo)) {
      profileQuery = profileQuery.eq('cohort_no', cohortNo)
    }

    if (affiliationId !== null && !Number.isNaN(affiliationId)) {
      profileQuery = profileQuery.eq('affiliation_id', affiliationId)
    }

    const { data: profileData, error: profileError } = await profileQuery
    if (profileError) {
      console.error('[monthly api] profile error:', profileError)
      return jsonNoStore({ error: '수련생 정보를 가져오지 못했습니다.' }, { status: 500 })
    }

    const profiles = ((profileData ?? []) as any[]).map(p => {
      let affName = '소속 없음'
      if (p.affiliations) {
        affName = Array.isArray(p.affiliations) ? p.affiliations[0]?.name : p.affiliations?.name
      }
      return {
        id: p.id,
        student_id: p.student_id,
        full_name: p.full_name,
        cohort_no: p.cohort_no,
        affiliation_id: p.affiliation_id,
        affiliation_name: affName || '소속 없음'
      }
    }).filter(p => {
      if (!keyword) return true
      return p.full_name.toLowerCase().includes(keyword) || p.student_id.toLowerCase().includes(keyword)
    })

    // 2. 행사 회차 목록 조회
    let occurrenceQuery = supabaseAdmin
      .from('event_occurrences')
      .select('id, event_id, occurrence_date, start_time, end_time, status, events(id, name)')
      .gte('occurrence_date', startDate)
      .lt('occurrence_date', endDate)
      .order('occurrence_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (eventId) {
      occurrenceQuery = occurrenceQuery.eq('event_id', eventId)
    }

    const { data: occurrenceData, error: occurrenceError } = await occurrenceQuery
    if (occurrenceError) {
      return jsonNoStore({ error: '회차 목록을 가져오지 못했습니다.' }, { status: 500 })
    }

    const occurrences = ((occurrenceData ?? []) as OccurrenceRow[]).map(o => {
      const ev = getJoinedEvent(o.events)
      return {
        id: o.id,
        event_id: o.event_id,
        event_name: ev?.name ?? '알 수 없는 행사',
        occurrence_date: o.occurrence_date,
        start_time: o.start_time,
        end_time: o.end_time,
        status: o.status
      }
    })

    // 3. 출석 기록 동시 대량 조회
    const profileIds = profiles.map(p => p.id)
    const occurrenceIds = occurrences.map(o => o.id)
    let attendanceMap = new Map<string, AttendanceRow>()

    if (profileIds.length > 0 && occurrenceIds.length > 0) {
      const { data: attData } = await supabaseAdmin
        .from('attendance')
        .select('id, user_id, event_id, occurrence_id, status, method, check_time')
        .in('user_id', profileIds)
        .in('occurrence_id', occurrenceIds)
        
      if (attData) {
        for (const att of (attData as AttendanceRow[])) {
          if (att.occurrence_id) {
            attendanceMap.set(`${att.user_id}:${att.occurrence_id}`, att)
          }
        }
      }
    }

    // 4. 셀 매핑 및 요약 통계 계산
    const summary = {
      trainee_count: profiles.length,
      occurrence_count: occurrences.length,
      present_count: 0,
      late_count: 0,
      absent_count: 0,
      unmarked_count: 0,
    }

    const rows = profiles.map(p => {
      const days: Record<string, any> = {}
      for (const o of occurrences) {
        const att = attendanceMap.get(`${p.id}:${o.id}`)
        const status = att?.status ?? 'unmarked'
        
        // 통계치 카운트 누적
        if (status === 'present') summary.present_count += 1
        else if (status === 'late') summary.late_count += 1
        else if (status === 'absent') summary.absent_count += 1
        else summary.unmarked_count += 1

        days[o.id] = {
          occurrence_id: o.id,
          event_id: o.event_id,
          event_name: o.event_name,
          occurrence_date: o.occurrence_date,
          status,
          attendance_id: att?.id ?? null,
          method: att?.method ?? null,
          check_time: att?.check_time ?? null
        }
      }
      return {
        profile_id: p.id,
        student_id: p.student_id,
        full_name: p.full_name,
        cohort_no: p.cohort_no,
        affiliation_name: p.affiliation_name,
        days
      }
    })

    return jsonNoStore({
      month,
      range: { start_date: startDate, end_date: endDate },
      filters: { cohort_no: cohortNo, keyword, event_id: eventId || null, affiliation_id: affiliationId },
      summary, // 💡 완성된 스네이크 케이스 기반의 온전한 수치 객체를 클라이언트로 내려줍니다.
      occurrences,
      rows
    }, { status: 200 })

  } catch (error: any) {
    console.error('[monthly api uncaught error]:', error)
    return new Response(JSON.stringify({ error: error?.message || '서버 내부 오류가 발생했습니다.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
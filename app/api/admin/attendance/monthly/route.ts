// app/api/admin/attendance/monthly/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonNoStore } from '@/lib/security/api-response'

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = request.nextUrl
    const month = searchParams.get('month') // 'YYYY-MM'
    const cohortNo = searchParams.get('cohort_no')
    const keyword = searchParams.get('keyword')
    const affiliationId = searchParams.get('affiliation_id')

    if (!month) {
      return jsonNoStore({ error: '조회할 월(month) 파라미터가 필요합니다.' }, { status: 400 })
    }

    const startDate = `${month}-01`
    const [year, nextMonth] = month.split('-').map(Number)
    const lastDay = new Date(year, nextMonth, 0).getDate()
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`

    // ----------------------------------------------------------------
    // 💡 변경 포인트: 단일 event_id 필터 대신 events 테이블 내 Toggle이 true인 것을 가져오도록 설정
    // ----------------------------------------------------------------
    let occurrenceQuery = supabaseAdmin
      .from('event_occurrences')
      .select(`
        id,
        event_id,
        occurrence_date,
        start_time,
        end_time,
        status,
        events!inner (
          id,
          name,
          affiliations_id,
          toggle
        )
      `)
      .gte('occurrence_date', startDate)
      .lte('occurrence_date', endDate)
      .neq('status', 'archived')
      // DB상에서 toggle이 true인 이벤트만 필터링하도록 강제 설정
      .eq('events.toggle', true) 

    if (affiliationId && affiliationId.trim() !== '') {
      const affIdNum = Number(affiliationId)
      occurrenceQuery = occurrenceQuery.or(`affiliations_id.eq.${affIdNum},affiliations_id.is.null`, { foreignTable: 'events' })
    }

    const { data: dbOccurrences, error: occError } = await occurrenceQuery.order('occurrence_date', { ascending: true })

    if (occError) {
      console.error('Occurrences fetch error:', occError)
      return jsonNoStore({ error: '회차 목록 조회 중 오류가 발생했습니다.' }, { status: 500 })
    }

    const occurrences = (dbOccurrences ?? []).map((occ: any) => ({
      id: occ.id,
      event_id: occ.event_id,
      event_name: occ.events?.name || '이름 없음',
      occurrence_date: occ.occurrence_date,
      start_time: occ.start_time,
      end_time: occ.end_time,
      status: occ.status,
    }))

    const validOccurrenceIds = occurrences.map((o: any) => o.id)

    // [중략 - 기존 수련생 프로필 로직 동일하게 유지]
    let profileQuery = supabaseAdmin
      .from('profiles')
      .select(`
        id,
        student_id,
        full_name,
        cohort_no,
        affiliations:profiles_affiliation_fkey ( name )
      `)
      .eq('enrollment_status', 'active')

    if (affiliationId && affiliationId.trim() !== '') {
      profileQuery = profileQuery.eq('affiliation_id', Number(affiliationId))
    }
    if (cohortNo && cohortNo.trim() !== '') {
      profileQuery = profileQuery.eq('cohort_no', Number(cohortNo))
    }
    if (keyword && keyword.trim() !== '') {
      profileQuery = profileQuery.or(`full_name.ilike.%${keyword}%,student_id.ilike.%${keyword}%`)
    }

    const { data: dbProfiles, error: profileError } = await profileQuery.order('student_id', { ascending: true })

    if (profileError) {
      console.error('Profiles fetch error:', profileError)
      return jsonNoStore({ error: '수련생 목록 조회 중 오류가 발생했습니다.' }, { status: 500 })
    }

    let rows: any[] = []
    let present_count = 0, late_count = 0, absent_count = 0, unmarked_count = 0

    if (dbProfiles && dbProfiles.length > 0 && validOccurrenceIds.length > 0) {
      const profileIds = dbProfiles.map((p) => p.id)
      const { data: dbAttendance, error: attError } = await supabaseAdmin
        .from('attendance')
        .select('id, user_id, event_id, occurrence_id, status, method, check_time')
        .in('user_id', profileIds)
        .in('occurrence_id', validOccurrenceIds)

      const attendanceMap = new Map<string, any>()
      if (!attError && dbAttendance) {
        dbAttendance.forEach((att) => {
          attendanceMap.set(`${att.user_id}_${att.occurrence_id}`, att)
        })
      }

      rows = dbProfiles.map((p: any) => {
        const daysCellObj: Record<string, any> = {}
        occurrences.forEach((occ: any) => {
          const attKey = `${p.id}_${occ.id}`
          const attRecord = attendanceMap.get(attKey)
          const status = attRecord?.status || 'unmarked'

          if (status === 'present') present_count++
          else if (status === 'late') late_count++
          else if (status === 'absent') absent_count++
          else unmarked_count++

          daysCellObj[occ.id] = {
            occurrence_id: occ.id,
            event_id: occ.event_id,
            event_name: occ.event_name,
            occurrence_date: occ.occurrence_date,
            status: status,
            attendance_id: attRecord?.id || null,
            method: attRecord?.method || null,
            check_time: attRecord?.check_time || null,
          }
        })
        return {
          profile_id: p.id,
          student_id: p.student_id,
          full_name: p.full_name,
          cohort_no: p.cohort_no,
          affiliation_name: p.affiliations?.name || '소속 없음',
          days: daysCellObj,
        }
      })
    }

    return jsonNoStore({
      month,
      range: { start_date: startDate, end_date: endDate },
      filters: {
        cohort_no: cohortNo ? Number(cohortNo) : null,
        keyword: keyword || '',
        affiliation_id: affiliationId || null,
      },
      summary: {
        trainee_count: dbProfiles?.length || 0,
        occurrence_count: occurrences.length,
        present_count,
        late_count,
        absent_count,
        unmarked_count,
      },
      occurrences,
      rows,
    })
  } catch (error) {
    console.error('[Monthly Attendance API Route Exception]:', error)
    return jsonNoStore({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
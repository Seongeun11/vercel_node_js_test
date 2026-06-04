// app/api/admin/attendance/monthly/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonNoStore } from '@/lib/security/api-response'

export async function GET(request: NextRequest): Promise<Response> {
  try {
    // 1. 관리자 권한 권한 검증
    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore({ error: authResult.error }, { status: authResult.status })
    }

    // 2. URL 검색 파라미터 추출
    const { searchParams } = request.nextUrl
    const month = searchParams.get('month') // 형식: 'YYYY-MM'
    const cohortNo = searchParams.get('cohort_no')
    const keyword = searchParams.get('keyword')
    const eventId = searchParams.get('event_id')
    const affiliationId = searchParams.get('affiliation_id') // 핵심 필터 대상

    if (!month) {
      return jsonNoStore({ error: '조회할 월(month) 파라미터가 필요합니다.' }, { status: 400 })
    }

    // 해당 월의 시작일과 종료일 계산 (KST 기준 안전 처리)
    const startDate = `${month}-01`
    const [year, nextMonth] = month.split('-').map(Number)
    const lastDay = new Date(year, nextMonth, 0).getDate()
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`

    // ----------------------------------------------------------------
    // 💡 [행사 회차 기본 쿼리 빌드]
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
          affiliations_id
        )
      `)
      .gte('occurrence_date', startDate)
      .lte('occurrence_date', endDate)
      .neq('status', 'archived')

    // ----------------------------------------------------------------
    // 💡 [논리오류 교정]: 소속 선택 시 선택된 소속 '또는' 공통(null) 행사 동시 조회
    // ----------------------------------------------------------------
    if (affiliationId && affiliationId.trim() !== '') {
      const affIdNum = Number(affiliationId)
      // Supabase .or() 메서드를 사용하여 (해당소속 ID 이거나 OR null 인 것) 구조를 충족합니다.
      occurrenceQuery = occurrenceQuery.or(`affiliations_id.eq.${affIdNum},affiliations_id.is.null`, { foreignTable: 'events' })
    }
    
    // 특정 행사 조건이 추가로 있다면 필터링
    if (eventId && eventId.trim() !== '') {
      occurrenceQuery = occurrenceQuery.eq('event_id', eventId)
    }

    const { data: dbOccurrences, error: occError } = await occurrenceQuery.order('occurrence_date', { ascending: true })

    if (occError) {
      console.error('Occurrences fetch error:', occError)
      return jsonNoStore({ error: '회차 목록 조회 중 오류가 발생했습니다.' }, { status: 500 })
    }

    // 데이터 안전 포맷팅
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

    // ----------------------------------------------------------------
    // 💡 수련생 프로필 및 출석 레코드 가져오기
    // ----------------------------------------------------------------
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

    // 수련생 자체의 소속 조건 필터링
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

    // ----------------------------------------------------------------
    // 3. 필터링된 회차 정보에 매핑되는 출석(attendance) 데이터 벌크 조회
    // ----------------------------------------------------------------
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

      // 프론트엔드가 요구하는 행(Row) 구조 매트릭스 조립
      rows = dbProfiles.map((p: any) => {
        const daysCellObj: Record<string, any> = {}

        occurrences.forEach((occ: any) => {
          const attKey = `${p.id}_${occ.id}`
          const attRecord = attendanceMap.get(attKey)
          const status = attRecord?.status || 'unmarked'

          // 통계 카운트 산출
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

    // 4. 최종 결과 반환 규격 준수하여 리턴
    return jsonNoStore({
      month,
      range: { start_date: startDate, end_date: endDate },
      filters: {
        cohort_no: cohortNo ? Number(cohortNo) : null,
        keyword: keyword || '',
        event_id: eventId || null,
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
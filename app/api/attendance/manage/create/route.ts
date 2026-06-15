// app/api/attendance/manage/create/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)
    
    // 1. 관리자 권한 검증 및 실행자 ID 확보
    const authResult = await requireRole(['admin'])
    if (!authResult.ok || !authResult.user) {
      return jsonNoStore({ error: '인증 및 관리자 권한이 필요합니다.' }, { status: 401 })
    }
    const adminUserId = authResult.user.id // 로그의 changed_by(수정한 관리자) 필드에 바인딩할 ID

    const body = await request.json()
    const { user_keyword, event_id, attendance_date, status, method, check_time, reason } = body

    // 필수 유효성 데이터 필드 검증
    if (!user_keyword || !event_id || !attendance_date || !status || !reason) {
      return jsonNoStore({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
    }

    // 2. 유저 매핑 룩업 (성명 또는 학번 기준)
    const { data: userData, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, student_id')
      .or(`full_name.eq.${user_keyword},student_id.eq.${user_keyword}`)

    if (userError) {
      return jsonNoStore({ error: `유저 조회 오류: ${userError.message}` }, { status: 500 })
    }
    if (!userData || userData.length === 0) {
      return jsonNoStore({ error: `'${user_keyword}' 명칭의 유저를 찾을 수 없습니다.` }, { status: 404 })
    }
    if (userData.length > 1) {
      return jsonNoStore({ error: `중복 유저가 존재합니다. 학번으로 식별해주세요.` }, { status: 409 })
    }
    const targetUserId = userData[0].id

    // 3. 행사 회차(event_occurrences) 존재 여부 검사 및 자동 보정
    let targetOccurrenceId: string | null = null

    const { data: occurrenceData, error: occurrenceFindError } = await supabaseAdmin
      .from('event_occurrences')
      .select('id')
      .eq('event_id', event_id)
      .eq('occurrence_date', attendance_date)
      .maybeSingle() 

    if (occurrenceFindError) {
      return jsonNoStore({ error: `회차 정보 조회 중 예외 발생: ${occurrenceFindError.message}` }, { status: 500 })
    }

    if (occurrenceData) {
      targetOccurrenceId = occurrenceData.id
    } else {
      const startTimeString = `${attendance_date}T09:00:00.000Z` 
      
      const { data: newOccurrence, error: occurrenceInsertError } = await supabaseAdmin
        .from('event_occurrences')
        .insert({
          event_id: event_id,
          occurrence_date: attendance_date,
          start_time: startTimeString,
          status: 'open'
        })
        .select('id')
        .single()

      if (occurrenceInsertError) {
        return jsonNoStore({ error: `소급 적용을 위한 행사 회차 생성 실패: ${occurrenceInsertError.message}` }, { status: 500 })
      }
      targetOccurrenceId = newOccurrence.id
    }

    // 4. 출석 데이터(attendance) 삽입 (Phase 1)
    const { data: attendanceData, error: attendanceError } = await supabaseAdmin
      .from('attendance')
      .insert([
        {
          user_id: targetUserId,
          event_id: event_id,
          occurrence_id: targetOccurrenceId,
          attendance_date: attendance_date, 
          status,
          method: method || 'manual',
          check_time: check_time ? new Date(check_time).toISOString() : new Date().toISOString()
        }
      ])
      .select()
      .single() // 단건 스냅샷 확보를 위해 single() 지정

    if (attendanceError) {
      console.error('[attendance/manage/create] DB Insert Error:', attendanceError)

      // 고유 제약 조건 위배(중복 등록) 에러 처리
      if (attendanceError.code === '23505' || (attendanceError.message && attendanceError.message.includes('uq_attendance_user_occurrence'))) {
        return jsonNoStore(
          { error: '이미 해당 회차에 출석 기록이 등록된 사용자입니다.' },
          { status: 409 }
        )
      }
      return jsonNoStore({ error: attendanceError.message || '출석 데이터 삽입에 실패했습니다.' }, { status: 500 })
    }

    // 5. 🎯 [신규 논리 추가] 출석 변경 이력 로그(attendance_logs) 적재 (Phase 2)
    const { error: logError } = await supabaseAdmin
      .from('attendance_logs')
      .insert([
        {
          attendance_id: attendanceData.id,     // 생성된 출석 ID 매핑
          changed_by: adminUserId,               // 요청을 실행한 관리자 ID
          target_user_id: targetUserId,          // 출석 처리 대상자 ID
          event_id: event_id,                    // 대상 행사 ID
          attendance_date: attendance_date,      // 출석 일자
          action: 'create',                      // CHECK 제약 조건에 맞게 'create' 명시
          reason: reason.trim(),                 // 관리자가 기입한 수동 생성 사유
          before_value: {},                      // 생성 이전이므로 빈 객체 스냅샷
          after_value: {                         // 생성된 객체 상태 스냅샷 저장
            id: attendanceData.id,
            status: attendanceData.status,
            method: attendanceData.method,
            check_time: attendanceData.check_time
          }
        }
      ])

    if (logError) {
      // 중요: 비즈니스 정합성을 위해 로그 적재 실패 시 콘솔에 에러를 기록합니다.
      console.error('[attendance/manage/create] 이력 로그(attendance_logs) 저장 실패:', logError)
      // 시스템 성격에 따라 로그 실패 시 전체 롤백 처리를 원하면 이 시점에 attendance 데이터를 지우고 에러 리턴을 하도록 분기할 수 있습니다.
    }

    return jsonNoStore({ 
      message: '과거 행사 회차 보정, 출석 생성 및 감사 로그 적재가 완료되었습니다.', 
      item: attendanceData 
    }, { status: 201 })

  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
    }
    console.error('[attendance/manage/create] unexpected error:', error)
    return jsonNoStore({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
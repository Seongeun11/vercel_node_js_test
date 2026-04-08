// app/api/attendance/edit/route.ts
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

const ALLOWED_STATUS = ['present', 'late', 'absent'] as const
const ALLOWED_METHOD = ['manual', 'qr', 'nfc'] as const

type AttendanceStatus = (typeof ALLOWED_STATUS)[number]
type AttendanceMethod = (typeof ALLOWED_METHOD)[number]

type EditAttendanceBody = {
  target_user_id?: string
  event_id?: string
  date?: string
  status?: AttendanceStatus
  method?: AttendanceMethod
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
 
    // 1) 먼저 권한 확인
    const authResult = await requireRole(['admin', 'captain'])

    if (!authResult.ok || !authResult.user) {
      return jsonNoStore(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    // 2) 요청 본문 파싱
    const body = (await request.json()) as EditAttendanceBody

    const targetUserId = String(body.target_user_id || '').trim()
    const eventId = String(body.event_id || '').trim()
    const date = String(body.date || '').trim()
    const status = body.status
    const method = body.method ?? 'manual'

    // 3) 입력값 검증
    if (!targetUserId || !eventId || !date || !status) {
      return jsonNoStore(
        { error: '필수 값이 누락되었습니다.' },
        { status: 400 }
      )
    }

    if (!ALLOWED_STATUS.includes(status)) {
      return jsonNoStore(
        { error: '유효하지 않은 출석 상태입니다.' },
        { status: 400 }
      )
    }

    if (!ALLOWED_METHOD.includes(method)) {
      return jsonNoStore(
        { error: '유효하지 않은 출석 방식입니다.' },
        { status: 400 }
      )
    }

    const nowIso = new Date().toISOString()

    // 4) 기존 출석 기록 조회
    const { data: existingAttendance, error: existingError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('event_id', eventId)
      .eq('date', date)
      .maybeSingle()

    if (existingError) {
      return jsonNoStore(
        { error: existingError.message },
        { status: 500 }
      )
    }

    // 5) 기존 기록이 없으면 신규 생성
    if (!existingAttendance) {
      const { data: insertedAttendance, error: insertError } = await supabaseAdmin
        .from('attendance')
        .insert({
          user_id: targetUserId,
          event_id: eventId,
          date,
          status,
          method,
          check_time: nowIso,
        })
        .select()
        .single()

      if (insertError || !insertedAttendance) {
        return jsonNoStore(
          { error: insertError?.message || '출석 기록 생성에 실패했습니다.' },
          { status: 500 }
        )
      }

      // 생성 로그 저장
      const { error: logInsertError } = await supabaseAdmin.from('attendance_logs').insert({
        attendance_id: insertedAttendance.id,
        changed_by: authResult.user.id,
        before_value: null,
        after_value: insertedAttendance,
        changed_at: nowIso,
      })

      if (logInsertError) {
        console.error('attendance log insert error:', logInsertError)
      }

      return jsonNoStore({
        message: '출석 기록이 새로 등록되었습니다.',
        attendance: insertedAttendance,
      })
    }

    // 6) 동일 값 변경 방지
    const updatePayload: Partial<{
      status: AttendanceStatus
      method: AttendanceMethod
      check_time: string
    }> = {}

    if (existingAttendance.status !== status) {
      updatePayload.status = status
    }

    if (existingAttendance.method !== method) {
      updatePayload.method = method
    }

    if (Object.keys(updatePayload).length === 0) {
      return jsonNoStore(
        { error: '동일한 출석 상태는 변경할 수 없습니다.' },
        { status: 400 }
      )
    }

    updatePayload.check_time = nowIso

    const beforeValue = existingAttendance

    // 7) 변경된 값만 업데이트
    const { data: updatedAttendance, error: updateError } = await supabaseAdmin
      .from('attendance')
      .update(updatePayload)
      .eq('id', existingAttendance.id)
      .select()
      .single()

    if (updateError || !updatedAttendance) {
      return jsonNoStore(
        { error: updateError?.message || '출석 기록 수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 8) 수정 로그 저장
    const { error: logUpdateError } = await supabaseAdmin.from('attendance_logs').insert({
      attendance_id: existingAttendance.id,
      changed_by: authResult.user.id,
      before_value: beforeValue,
      after_value: updatedAttendance,
      changed_at: nowIso,
    })

    if (logUpdateError) {
      console.error('attendance log update error:', logUpdateError)
    }

    return jsonNoStore({
      message: '출석 기록이 수정되었습니다.',
      attendance: updatedAttendance,
    })
  } catch (error) {
    console.error('attendance/edit POST error:', error)
    return jsonNoStore(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
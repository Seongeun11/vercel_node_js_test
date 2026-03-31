//api/attendance/edit/route.ts

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { requireRole } from '@/lib/serverAuth'

const ALLOWED_STATUS = ['present', 'late', 'absent'] as const

export async function POST(request: Request) {
  try {
    const {
      actor_user_id,
      target_user_id,
      event_id,
      date,
      status,
      method = 'manual',
    } = await request.json()

    // 필수값 검증
    if (!actor_user_id || !target_user_id || !event_id || !date || !status) {
      return NextResponse.json(
        { error: '필수 값이 누락되었습니다.' },
        { status: 400 }
      )
    }

    if (!ALLOWED_STATUS.includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 출석 상태입니다.' },
        { status: 400 }
      )
    }

    // 수정 권한 확인: admin, captain만 허용
    const authResult = await requireRole(actor_user_id, ['admin', 'captain'])

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    // 기존 출석 기록 조회
    const { data: existingAttendance, error: existingError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', target_user_id)
      .eq('event_id', event_id)
      .eq('date', date)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      )
    }

    const nowIso = new Date().toISOString()

    // 1) 기록이 없으면 새로 생성
    if (!existingAttendance) {
      const { data: insertedAttendance, error: insertError } = await supabase
        .from('attendance')
        .insert({
          user_id: target_user_id,
          event_id,
          date,
          status,
          method,
          check_time: nowIso,
        })
        .select()
        .single()

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        )
      }

      // 로그 저장
      const { error: logError } = await supabase
        .from('attendance_logs')
        .insert({
          attendance_id: insertedAttendance.id,
          changed_by: actor_user_id,
          before_value: null,
          after_value: insertedAttendance,
          changed_at: new Date().toISOString(),
        })

      if (logError) {
        console.error('attendance_logs insert 실패:', logError.message)
      }

      return NextResponse.json({
        message: '출석 기록이 새로 등록되었습니다.',
        attendance: insertedAttendance,
      })
    }

    // 2) 기록이 있으면 수정
    const beforeValue = existingAttendance

    const { data: updatedAttendance, error: updateError } = await supabase
      .from('attendance')
      .update({
        status,
        method,
        check_time: nowIso,
      })
      .eq('id', existingAttendance.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // 로그 저장
    const { error: logError } = await supabase
      .from('attendance_logs')
      .insert({
        attendance_id: existingAttendance.id,
        changed_by: actor_user_id,
        before_value: beforeValue,
        after_value: updatedAttendance,
        changed_at: new Date().toISOString(),
      })

    if (logError) {
      console.error('attendance_logs insert 실패:', logError.message)
    }

    return NextResponse.json({
      message: '출석 기록이 수정되었습니다.',
      attendance: updatedAttendance,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
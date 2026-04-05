// app/api/attendance/detail/route.ts
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type DetailAttendanceBody = {
  target_user_id?: string
  event_id?: string
  date?: string
}

export async function POST(request: Request) {
  try {
    // 1) 권한 체크 (admin / captain만 조회 가능)
    const authResult = await requireRole(['admin', 'captain'])

    if (!authResult.ok || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    // 2) 요청 파싱
    const body = (await request.json()) as DetailAttendanceBody

    const targetUserId = String(body.target_user_id || '').trim()
    const eventId = String(body.event_id || '').trim()
    const date = String(body.date || '').trim()

    // 3) 입력값 검증
    if (!targetUserId || !eventId || !date) {
      return NextResponse.json(
        { error: '필수 값이 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 날짜 포맷 간단 검증 (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    // 4) attendance 조회 (service role 사용)
    const { data, error } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('event_id', eventId)
      .eq('date', date)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // 5) 결과 반환
    return NextResponse.json(
      {
        attendance: data ?? null,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('attendance/detail POST error:', error)
    return NextResponse.json(
      { error: '출석 상세 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
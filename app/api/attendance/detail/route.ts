// app/api/attendance/detail/route.ts
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type DetailAttendanceBody = {
  target_user_id?: string
  event_id?: string
  date?: string
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
 
    // 1) 권한 체크 (admin / captain만 조회 가능)
    const authResult = await requireRole(['admin', 'captain'])

    if (!authResult.ok || !authResult.user) {
      return jsonNoStore(
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
      return jsonNoStore(
        { error: '필수 값이 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 날짜 포맷 간단 검증 (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonNoStore(
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
      return jsonNoStore(
        { error: error.message },
        { status: 500 }
      )
    }

    // 5) 결과 반환
    return jsonNoStore(
      {
        attendance: data ?? null,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }  
  }
}
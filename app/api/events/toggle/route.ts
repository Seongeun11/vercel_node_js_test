// app/api/events/toggle/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonNoStore } from '@/lib/security/api-response'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // 1. 관리자 권한 검증
    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore({ error: authResult.error }, { status: authResult.status })
    }

    const { eventId, toggleState } = await request.json()

    if (!eventId) {
      return jsonNoStore({ error: 'eventId가 누락되었습니다.' }, { status: 400 })
    }

    // 2. Supabase DB의 events 테이블 Toggle 컬럼 업데이트
    const { error } = await supabaseAdmin
      .from('events')
      .update({ toggle: toggleState })
      .eq('id', eventId)

    if (error) {
      console.error('[Event Toggle Update Error]:', error)
      return jsonNoStore({ error: '이벤트 토글 상태 업데이트에 실패했습니다.' }, { status: 500 })
    }

    return jsonNoStore({ success: true, eventId, Toggle: toggleState })
  } catch (error) {
    console.error('[Event Toggle API Exception]:', error)
    return jsonNoStore({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}
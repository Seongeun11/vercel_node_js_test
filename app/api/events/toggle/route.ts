// app/api/events/toggle/route.ts
import { NextRequest } from 'next/server'
import { getSessionProfile } from '@/lib/server-session'
import { jsonNoStore } from '@/lib/security/api-response'


export async function PATCH(request: NextRequest): Promise<Response> {
  const session = await getSessionProfile(['admin'])
  if (!session.ok) {
    return jsonNoStore({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  try {

    const { eventId, toggleState } = await request.json()

    if (!eventId) {
      return jsonNoStore({ error: '필수 파라미터(eventId)가 누락되었습니다.' }, { status: 400 })
    }

    // DB의 events 테이블 Toggle 값을 업데이트합니다.
    const { data, error } = await session.supabase
      .from('events')
      .update({ Toggle: toggleState })
      .eq('id', eventId)
      .select('id, name, Toggle')
      .single()

    if (error) {
      console.error('Toggle DB update error:', error)
      return jsonNoStore({ error: 'DB 상태 변경 중 오류가 발생했습니다.' }, { status: 500 })
    }

    return jsonNoStore({ success: true, item: data })
  } catch (err) {
    return jsonNoStore({ error: '잘못된 요청 양식입니다.' }, { status: 400 })
  }
}
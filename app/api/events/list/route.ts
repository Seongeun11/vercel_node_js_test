import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { requireRole } from '@/lib/serverAuth'

export async function POST(request: Request) {
  try {
    const { actor_user_id } = await request.json()

    if (!actor_user_id) {
      return NextResponse.json(
        { error: 'actor_user_id가 필요합니다.' },
        { status: 400 }
      )
    }

    const authResult = await requireRole(actor_user_id, ['admin', 'captain'])

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { data, error } = await supabase
      .from('events')
      .select('id, name, start_time, late_threshold_min')
      .order('start_time', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ events: data ?? [] }, { status: 200 })
  } catch (error) {
    console.error('events/list POST error:', error)
    return NextResponse.json(
      { error: '이벤트 목록 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
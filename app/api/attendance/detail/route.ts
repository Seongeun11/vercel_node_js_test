import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { requireRole } from '@/lib/serverAuth'

export async function POST(request: Request) {
  try {
    const { target_user_id, event_id, date } = await request.json()

    if (!target_user_id || !event_id || !date) {
      return NextResponse.json(
        { error: '필수 값이 누락되었습니다.' },
        { status: 400 }
      )
    }

    const authResult = await requireRole(['admin', 'captain'])

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', target_user_id)
      .eq('event_id', event_id)
      .eq('date', date)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

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

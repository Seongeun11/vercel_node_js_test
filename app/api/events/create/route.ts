import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { requireRole } from '@/lib/serverAuth'

const ALLOWED_EVENT_TYPES = ['normal', 'special'] as const

export async function POST(request: Request) {
  try {
    const {
      name,
      type = 'normal',
      start_time,
      late_threshold_min = 10,
      allow_duplicate = false,
    } = await request.json()

    if (!name || !start_time) {
      return NextResponse.json(
        { error: '필수 값이 누락되었습니다.' },
        { status: 400 }
      )
    }

    const authResult = await requireRole(['admin'])

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    if (!ALLOWED_EVENT_TYPES.includes(type)) {
      return NextResponse.json(
        { error: '유효하지 않은 이벤트 타입입니다.' },
        { status: 400 }
      )
    }

    const lateThreshold = Number(late_threshold_min)

    if (Number.isNaN(lateThreshold) || lateThreshold < 0) {
      return NextResponse.json(
        { error: '지각 기준 분은 0 이상 숫자여야 합니다.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        name: String(name).trim(),
        type,
        start_time,
        late_threshold_min: lateThreshold,
        allow_duplicate: Boolean(allow_duplicate),
        created_by: authResult.user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: '이벤트가 생성되었습니다.',
        event: data,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('events/create POST error:', error)
    return NextResponse.json(
      { error: '이벤트 생성 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

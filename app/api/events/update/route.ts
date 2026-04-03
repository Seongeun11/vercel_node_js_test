import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { requireRole } from '@/lib/serverAuth'

const ALLOWED_TYPES = ['normal', 'special'] as const

type UpdateEventBody = {
  id?: string
  name?: string
  type?: 'normal' | 'special'
  start_time?: string
  late_threshold_min?: number
  allow_duplicate?: boolean
}

export async function POST(request: Request) {
  try {
    const authResult = await requireRole(['admin'])

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as UpdateEventBody
    const { id, name, type, start_time, late_threshold_min, allow_duplicate } = body

    if (!id || !name || !type || !start_time) {
      return NextResponse.json(
        { error: '필수 값이 누락되었습니다.' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(type)) {
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

    const { data: existingEvent, error: existingError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single()

    if (existingError || !existingEvent) {
      return NextResponse.json(
        { error: '수정할 이벤트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const normalizedName = String(name).trim()
    const normalizedAllowDuplicate = Boolean(allow_duplicate)

    const isSame =
      existingEvent.name === normalizedName &&
      existingEvent.type === type &&
      new Date(existingEvent.start_time).toISOString() === new Date(start_time).toISOString() &&
      Number(existingEvent.late_threshold_min) === lateThreshold &&
      Boolean(existingEvent.allow_duplicate) === normalizedAllowDuplicate

    if (isSame) {
      return NextResponse.json(
        { error: '변경된 내용이 없습니다.' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('events')
      .update({
        name: normalizedName,
        type,
        start_time,
        late_threshold_min: lateThreshold,
        allow_duplicate: normalizedAllowDuplicate,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        message: '이벤트가 수정되었습니다.',
        event: data,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('events/update POST error:', error)
    return NextResponse.json(
      { error: '이벤트 수정 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
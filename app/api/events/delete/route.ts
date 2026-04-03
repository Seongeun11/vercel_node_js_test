import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { requireRole } from '@/lib/serverAuth'

type DeleteEventBody = {
  id?: string
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

    const body = (await request.json()) as DeleteEventBody
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { error: '삭제할 이벤트 id가 필요합니다.' },
        { status: 400 }
      )
    }

    const { data: existingEvent, error: existingError } = await supabase
      .from('events')
      .select('id, name')
      .eq('id', id)
      .single()

    if (existingError || !existingEvent) {
      return NextResponse.json(
        { error: '삭제할 이벤트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const { count: attendanceCount, error: attendanceError } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)

    if (attendanceError) {
      return NextResponse.json(
        { error: attendanceError.message },
        { status: 500 }
      )
    }

    if ((attendanceCount ?? 0) > 0) {
      return NextResponse.json(
        { error: '출석 기록이 있는 이벤트는 삭제할 수 없습니다.' },
        { status: 409 }
      )
    }

    const { count: qrTokenCount, error: qrTokenError } = await supabase
      .from('qr_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)

    if (qrTokenError) {
      return NextResponse.json(
        { error: qrTokenError.message },
        { status: 500 }
      )
    }

    if ((qrTokenCount ?? 0) > 0) {
      return NextResponse.json(
        { error: 'QR 토큰이 연결된 이벤트는 먼저 QR 데이터를 정리한 뒤 삭제해주세요.' },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { message: `"${existingEvent.name}" 이벤트가 삭제되었습니다.` },
      { status: 200 }
    )
  } catch (error) {
    console.error('events/delete POST error:', error)
    return NextResponse.json(
      { error: '이벤트 삭제 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
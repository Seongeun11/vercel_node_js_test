// app/api/events/delete/route.ts
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type DeleteEventBody = {
  id?: string
}

type DeleteEventResponse = {
  message?: string
  error?: string
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])

    if (!authResult.ok) {
      return jsonNoStore<DeleteEventResponse>(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as DeleteEventBody
    const id = String(body.id ?? '').trim()

    if (!id) {
      return jsonNoStore<DeleteEventResponse>(
        { error: '이벤트 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const { data: existingEvent, error: existingError } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('id', id)
      .single()

    if (existingError || !existingEvent) {
      return jsonNoStore<DeleteEventResponse>(
        { error: '삭제할 이벤트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const [
      { count: attendanceCount, error: attendanceCountError },
      { count: qrCount, error: qrCountError },
    ] = await Promise.all([
      supabaseAdmin
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', id),
      supabaseAdmin
        .from('qr_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', id),
    ])

    if (attendanceCountError || qrCountError) {
      return jsonNoStore<DeleteEventResponse>(
        {
          error:
            attendanceCountError?.message ||
            qrCountError?.message ||
            '연관 데이터 확인에 실패했습니다.',
        },
        { status: 500 }
      )
    }

    if ((attendanceCount ?? 0) > 0 || (qrCount ?? 0) > 0) {
      return jsonNoStore<DeleteEventResponse>(
        {
          error: '출석 기록 또는 QR 토큰이 연결된 이벤트는 삭제할 수 없습니다.',
        },
        { status: 400 }
      )
    }

    const { error: deleteError } = await supabaseAdmin
      .from('events')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return jsonNoStore<DeleteEventResponse>(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    return jsonNoStore<DeleteEventResponse>(
      { message: '이벤트가 삭제되었습니다.' },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<DeleteEventResponse>(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('[events/delete] unexpected error:', error)
    }

    return jsonNoStore<DeleteEventResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
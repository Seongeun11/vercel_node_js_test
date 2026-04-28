// app/api/qr/delete/route.ts
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type DeleteQrBody = {
  id?: string
}

type DeleteQrResponse = {
  message?: string
  deleted_qr?: {
    id: string
    event_id: string
    occurrence_id: string | null
  }
  error?: string
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])

    if (!authResult.ok) {
      return jsonNoStore<DeleteQrResponse>(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as DeleteQrBody
    const id = String(body.id ?? '').trim()

    if (!id) {
      return jsonNoStore<DeleteQrResponse>(
        { error: 'QR ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // ✅ 삭제 전에 회차 기반 QR인지 확인
    const { data: existingQr, error: existingError } = await supabaseAdmin
      .from('qr_tokens')
      .select('id, event_id, occurrence_id')
      .eq('id', id)
      .single()

    if (existingError || !existingQr) {
      return jsonNoStore<DeleteQrResponse>(
        { error: '삭제할 QR을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }
/*
    if (!existingQr.occurrence_id) {
      return jsonNoStore<DeleteQrResponse>(
        { error: '회차 기반 QR이 아닙니다. 마이그레이션이 필요합니다.' },
        { status: 400 }
      )
    }


    // ✅ 연결된 회차가 실제 존재하는지 검증
    const { data: occurrence, error: occurrenceError } = await supabaseAdmin
      .from('event_occurrences')
      .select('id')
      .eq('id', existingQr.occurrence_id)
      .single()

    if (occurrenceError || !occurrence) {
      return jsonNoStore<DeleteQrResponse>(
        { error: '연결된 회차를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }*/

    const { error: deleteError } = await supabaseAdmin
      .from('qr_tokens')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return jsonNoStore<DeleteQrResponse>(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    return jsonNoStore<DeleteQrResponse>(
      {
        message: 'QR이 삭제되었습니다.',
        deleted_qr: {
          id: existingQr.id,
          event_id: existingQr.event_id,
          occurrence_id: existingQr.occurrence_id,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<DeleteQrResponse>(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('[qr/delete] unexpected error:', error)
    }

    return jsonNoStore<DeleteQrResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
// app/api/event-occurrences/close/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type CloseOccurrenceBody = {
  occurrence_id?: string
}

type CloseOccurrenceResponse = {
  message?: string
  occurrence?: {
    id: string
    event_id: string
    occurrence_date: string
    status: string
    end_time: string | null
  }
  error?: string
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore<CloseOccurrenceResponse>(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as CloseOccurrenceBody
    const occurrenceId = String(body.occurrence_id ?? '').trim()

    if (!occurrenceId) {
      return jsonNoStore<CloseOccurrenceResponse>(
        { error: '회차 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const { data: existingOccurrence, error: existingError } = await supabaseAdmin
      .from('event_occurrences')
      .select('id, event_id, occurrence_date, status, end_time')
      .eq('id', occurrenceId)
      .single()

    if (existingError) {
      return jsonNoStore<CloseOccurrenceResponse>(
        { error: existingError.message },
        { status: 500 }
      )
    }

    if (!existingOccurrence) {
      return jsonNoStore<CloseOccurrenceResponse>(
        { error: '회차를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (existingOccurrence.status === 'archived') {
      return jsonNoStore<CloseOccurrenceResponse>(
        { error: '보관된 회차는 종료할 수 없습니다.' },
        { status: 400 }
      )
    }

    if (existingOccurrence.status === 'closed') {
      return jsonNoStore<CloseOccurrenceResponse>(
        {
          message: '이미 종료된 회차입니다.',
          occurrence: existingOccurrence,
        },
        { status: 200 }
      )
    }

    const nowIso = new Date().toISOString()

    const { data: updatedOccurrence, error: updateError } = await supabaseAdmin
      .from('event_occurrences')
      .update({
        status: 'closed',
        end_time: nowIso,
      })
      .eq('id', occurrenceId)
      .select('id, event_id, occurrence_date, status, end_time')
      .single()

    if (updateError || !updatedOccurrence) {
      return jsonNoStore<CloseOccurrenceResponse>(
        { error: updateError?.message || '회차 종료에 실패했습니다.' },
        { status: 500 }
      )
    }

    return jsonNoStore<CloseOccurrenceResponse>(
      {
        message: '회차가 종료되었습니다.',
        occurrence: updatedOccurrence,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<CloseOccurrenceResponse>(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('[event-occurrences/close] unexpected error:', error)
    }

    return jsonNoStore<CloseOccurrenceResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
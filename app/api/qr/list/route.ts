// app/api/qr/list/route.ts
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type ListQrBody = {
  occurrence_id?: string
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as ListQrBody
    const occurrenceId = String(body.occurrence_id || '').trim()

    let query = supabaseAdmin
      .from('qr_tokens')
      .select(`
        id,
        event_id,
        occurrence_id,
        token,
        expires_at,
        used_count,
        created_at,
        event_occurrences (
          id,
          occurrence_date,
          start_time,
          status
        ),
        events (
          id,
          name,
          start_time
        )
      `)
      .order('created_at', { ascending: false })

    if (occurrenceId) {
      query = query.eq('occurrence_id', occurrenceId)
    }

    const { data, error } = await query

    if (error) {
      return jsonNoStore(
        { error: error.message },
        { status: 500 }
      )
    }

    const now = Date.now()
    const origin = request.nextUrl.origin

    const qrTokens = (data ?? []).map((item: any) => {
      const expiresAtMs = item.expires_at ? new Date(item.expires_at).getTime() : null

      return {
        ...item,
        qr_url: `${origin}/attendance/scan?token=${item.token}`,
        is_expired:
          expiresAtMs === null
            ? false
            : Number.isNaN(expiresAtMs)
              ? true
              : now > expiresAtMs,
        occurrence_date: item.event_occurrences?.occurrence_date ?? null,
        occurrence_status: item.event_occurrences?.status ?? null,
      }
    })

    return jsonNoStore(
      {
        qr_tokens: qrTokens,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('[qr/list] unexpected error:', error)
    }

    return jsonNoStore(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
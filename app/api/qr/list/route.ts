// app/api/qr/list/route.ts
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type ListQrBody = {
  event_id?: string
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
    const eventId = String(body.event_id || '').trim()

    let query = supabaseAdmin
      .from('qr_tokens')
      .select(`
        id,
        event_id,
        token,
        expires_at,
        used_count,
        created_at,
        events (
          id,
          name,
          start_time
        )
      `)
      .order('created_at', { ascending: false })

    if (eventId) {
      query = query.eq('event_id', eventId)
    }

    const { data, error } = await query

    if (error) {
      return jsonNoStore(
        { error: error.message },
        { status: 500 }
      )
    }

    const now = Date.now()

    const qrTokens = (data ?? []).map((item: any) => {
      const expiresAtMs = new Date(item.expires_at).getTime()

      return {
        ...item,
        is_expired: Number.isNaN(expiresAtMs) ? true : now > expiresAtMs,
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
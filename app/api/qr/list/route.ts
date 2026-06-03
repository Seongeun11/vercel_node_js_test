// app/api/qr/list/route.ts
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'
//qr 암호/복호화
import { decryptQrToken, maskQrToken } from '@/lib/security/qr-token' 

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
    // occurrenceId가 있으면 먼저 해당 회차의 event_id를 찾는다.
    let eventId: string | null = null

    if (occurrenceId) {
    const { data: occurrence } = await supabaseAdmin
      .from('event_occurrences')
      .select('event_id')
      .eq('id', occurrenceId)
      .single()

    eventId = occurrence?.event_id ?? null
    }

    
    let query = supabaseAdmin
      .from('qr_tokens')
      .select(`
        id,
        event_id,
        occurrence_id,
        token_encrypted,
        expires_at,
        used_count,
        created_at
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (occurrenceId) {
  if (!eventId) {
    return jsonNoStore(
      { error: '회차를 찾을 수 없습니다.' },
      { status: 404 }
    )
  }

  query = query
    // 같은 행사의 QR만 조회
    .eq('event_id', eventId)
    // 오늘 회차 QR + 행사 공용 무제한 QR
    .or(`occurrence_id.eq.${occurrenceId},occurrence_id.is.null`)
}
    
   

    const { data, error } = await query

    if (error) {
      return jsonNoStore(
        { error: error.message },
        { status: 500 }
      )
    }


    const origin = request.nextUrl.origin
    const now = Date.now()

    const qrTokens = (data ?? []).map((qr) => {
      let rawToken: string | null = null
      let qrUrl: string | null = null
      let tokenPreview = '복원 불가'

      if (qr.token_encrypted) {
        try {
          rawToken = decryptQrToken(qr.token_encrypted)
          qrUrl = `${origin}/attendance/scan?token=${rawToken}`
          tokenPreview = maskQrToken(rawToken)
        } catch {
          rawToken = null
          qrUrl = null
          tokenPreview = '복호화 실패'
        }
      }

      const expiresAtMs = qr.expires_at
        ? new Date(qr.expires_at).getTime()
        : null

      return {
        id: qr.id,
        event_id: qr.event_id,
        occurrence_id: qr.occurrence_id,
        token_preview: tokenPreview,
        qr_url: qrUrl,
        expires_at: qr.expires_at,
        used_count: qr.used_count,
        created_at: qr.created_at,
        is_expired:
          expiresAtMs === null
            ? false
            : Number.isNaN(expiresAtMs)
              ? true
              : now > expiresAtMs,
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
// app/api/qr/create/route.ts
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type CreateQrBody = {
  event_id?: string
  expire_minutes?: number
}

function generateQrToken() {
  return crypto.randomBytes(24).toString('hex')
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

    const body = (await request.json()) as CreateQrBody

    const eventId = String(body.event_id || '').trim()
    const expireMinutes = Number(body.expire_minutes ?? 60)

    if (!eventId) {
      return jsonNoStore(
        { error: 'event_id가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!Number.isFinite(expireMinutes) || expireMinutes < 1 || expireMinutes > 60) {
      return jsonNoStore(
        { error: 'QR 유효 시간은 1~60분 사이여야 합니다.' },
        { status: 400 }
      )
    }

    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('id, name, start_time')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return jsonNoStore(
        { error: '이벤트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + expireMinutes * 60 * 1000)
    const token = generateQrToken()

    const { data: createdQrToken, error: createError } = await supabaseAdmin
      .from('qr_tokens')
      .insert({
        event_id: eventId,
        token,
        expires_at: expiresAt.toISOString(),
        used_count: 0,
      })
      .select('id, event_id, token, expires_at, used_count, created_at')
      .single()

    if (createError || !createdQrToken) {
      return jsonNoStore(
        { error: createError?.message || 'QR 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    return jsonNoStore(
      {
        message: 'QR이 생성되었습니다.',
        qr_token: createdQrToken,
        event: {
          id: event.id,
          name: event.name,
          start_time: event.start_time,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }
  }
}
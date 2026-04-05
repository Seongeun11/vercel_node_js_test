// app/api/qr/create/route.ts
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type CreateQrBody = {
  event_id?: string
  expire_minutes?: number
}

function generateQrToken() {
  return crypto.randomBytes(24).toString('hex')
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

    const body = (await request.json()) as CreateQrBody

    const eventId = String(body.event_id || '').trim()
    const expireMinutes = Number(body.expire_minutes ?? 60)

    if (!eventId) {
      return NextResponse.json(
        { error: 'event_id가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!Number.isFinite(expireMinutes) || expireMinutes < 1 || expireMinutes > 60) {
      return NextResponse.json(
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
      return NextResponse.json(
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
      return NextResponse.json(
        { error: createError?.message || 'QR 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
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
    console.error('qr/create POST error:', error)
    return NextResponse.json(
      { error: 'QR 생성 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
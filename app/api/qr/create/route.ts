//api/qr/create/route.ts
import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { requireRole } from '@/lib/serverAuth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { actor_user_id, event_id, expire_minutes = 60 } = body

    if (!actor_user_id || !event_id) {
      return NextResponse.json(
        { error: 'actor_user_id와 event_id가 필요합니다.' },
        { status: 400 }
      )
    }

    const authResult = await requireRole(actor_user_id, ['admin'])

    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const expireMinutes = Number(expire_minutes)

    if (Number.isNaN(expireMinutes) || expireMinutes < 1 || expireMinutes > 60) {
      return NextResponse.json(
        { error: 'expire_minutes는 1~60분 사이여야 합니다.' },
        { status: 400 }
      )
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, name, start_time')
      .eq('id', event_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: '이벤트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const token = randomUUID()
    const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000).toISOString()

    const { data: qrToken, error: insertError } = await supabase
      .from('qr_tokens')
      .insert({
        event_id,
        token,
        expires_at: expiresAt,
        created_by: actor_user_id,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    //vercel에서 주소 받아오기
    function getOrigin(request: Request): string {
    const url = new URL(request.url)

    // 기본
    let origin = url.origin

    // Vercel / proxy 대응
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto')

    if (forwardedHost && forwardedProto) {
      origin = `${forwardedProto}://${forwardedHost}`
    }

    return origin
  }


    const origin = getOrigin(request)

    const scanUrl = `${origin}/attendance/scan?token=${encodeURIComponent(token)}`

    return NextResponse.json(
      {
        message: 'QR 토큰이 생성되었습니다.',
        qr_token: qrToken,
        event,
        scan_url: scanUrl,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('qr/create POST error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'QR 토큰 생성 중 서버 오류가 발생했습니다.',
      },
      { status: 500 }
    )
  }
}
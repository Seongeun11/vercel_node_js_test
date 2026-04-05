// app/api/attendance/check/route.ts
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

function getKSTDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function getKSTDateTimeString(date = new Date()): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

type CheckAttendanceBody = {
  event_id?: string
  token?: string
}

export async function POST(request: Request) {
  try {
    // 1) 인증 + 권한
    const authResult = await requireRole(['admin', 'captain', 'trainee'])

    if (!authResult.ok || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const user_id = authResult.user.id

    // 2) 요청 파싱
    const { event_id, token } = (await request.json()) as CheckAttendanceBody

    let resolvedEventId = event_id

    // 3) QR 토큰 처리
    if (token) {
      const { data: qrToken, error: qrError } = await supabaseAdmin
        .from('qr_tokens')
        .select('id, event_id, expires_at, used_count')
        .eq('token', token)
        .single()

      if (qrError || !qrToken) {
        return NextResponse.json(
          { error: '유효하지 않은 QR 토큰입니다.' },
          { status: 400 }
        )
      }

      const now = new Date()
      const expiresAt = new Date(qrToken.expires_at)

      if (Number.isNaN(expiresAt.getTime()) || now > expiresAt) {
        return NextResponse.json(
          { error: '만료된 QR 코드입니다.' },
          { status: 400 }
        )
      }

      resolvedEventId = qrToken.event_id
    }

    if (!resolvedEventId) {
      return NextResponse.json(
        { error: 'event_id 또는 token이 필요합니다.' },
        { status: 400 }
      )
    }

    // 4) 이벤트 조회
    const { data: event, error: eventError } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', resolvedEventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: '이벤트 없음' }, { status: 400 })
    }

    const now = new Date()
    const startTime = new Date(event.start_time)

    if (Number.isNaN(startTime.getTime())) {
      return NextResponse.json(
        { error: '이벤트 시간이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    const lateLimit = new Date(
      startTime.getTime() +
        Number(event.late_threshold_min || 0) * 60 * 1000
    )

    const status = now > lateLimit ? 'late' : 'present'
    const attendanceDateKST = getKSTDateString(now)

    // 5) 출석 기록 insert (중복 방지: DB unique constraint)
    const { error: insertError } = await supabaseAdmin
      .from('attendance')
      .insert({
        user_id,
        event_id: resolvedEventId,
        date: attendanceDateKST,
        status,
        check_time: now.toISOString(),
        method: token ? 'qr' : 'manual',
      })

    if (insertError) {
      // 중복 출석 (unique constraint)
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: '이미 출석하셨습니다.' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    // 6) QR 토큰 사용 횟수 증가 (race-safe)
    if (token) {
      await supabaseAdmin.rpc('increment_qr_token_used_count', {
        p_token: token,
      })
      // 아래 RPC 없으면 fallback:
      // await supabaseAdmin
      //   .from('qr_tokens')
      //   .update({ used_count: sql`used_count + 1` }) ❌ supabase-js 미지원
    }

    return NextResponse.json({
      status,
      message: status === 'late' ? '지각입니다 ⏰' : '출석 완료 ✅',
      recorded_at_utc: now.toISOString(),
      recorded_at_kst: getKSTDateTimeString(now),
      attendance_date_kst: attendanceDateKST,
    })
  } catch (error) {
    console.error('[attendance/check] error:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
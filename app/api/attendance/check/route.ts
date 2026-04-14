// app/api/attendance/check/route.ts
import { NextRequest } from 'next/server'
import { getSessionProfile } from '@/lib/server-session'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type AttendanceCheckResponse = {
  success?: boolean
  status?: 'present' | 'late'
  event_id?: string
  check_time?: string
  error?: string
}

type AttendanceCheckRequest = {
  token?: string
}

function toKstDateString(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(date)
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const session = await getSessionProfile(['admin', 'captain', 'trainee'])
    if (!session.ok) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: session.error },
        { status: session.status }
      )
    }

    const body = (await request.json()) as AttendanceCheckRequest
    const token = typeof body?.token === 'string' ? body.token.trim() : ''

    if (!token) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: 'QR 토큰이 필요합니다.' },
        { status: 400 }
      )
    }

    // 1) QR 토큰 검증
    const { data: qrToken, error: qrError } = await session.supabase
      .from('qr_tokens')
      .select('event_id, expires_at, deleted_at')
      .eq('token', token)
      .is('deleted_at', null)
      .maybeSingle()

    if (qrError) {
      console.error('[attendance/check] qr query error:', qrError)
      return jsonNoStore<AttendanceCheckResponse>(
        { error: 'QR 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    if (!qrToken) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '유효하지 않은 QR입니다.' },
        { status: 404 }
      )
    }

    const now = new Date()
    const expiresAt = new Date(qrToken.expires_at)

    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '만료된 QR입니다.' },
        { status: 410 }
      )
    }

    // 2) 이벤트 검증
    const { data: event, error: eventError } = await session.supabase
      .from('events')
      .select('id, start_time, late_threshold_min, deleted_at')
      .eq('id', qrToken.event_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (eventError) {
      console.error('[attendance/check] event query error:', eventError)
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '행사 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    if (!event) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '행사를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 3) 출석 상태 계산
    const startTime = new Date(event.start_time)
    if (Number.isNaN(startTime.getTime())) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '행사 시작 시간이 올바르지 않습니다.' },
        { status: 500 }
      )
    }

    const lateThresholdMin =
      typeof event.late_threshold_min === 'number' ? event.late_threshold_min : 5

    const lateDeadline = new Date(
      startTime.getTime() + lateThresholdMin * 60_000
    )

    const attendanceStatus: 'present' | 'late' =
      now > lateDeadline ? 'late' : 'present'

    // 요구사항의 "동일 사용자 + 동일 행사 + 동일 날짜 1회"
    // 날짜는 KST 기준으로 맞추는 편이 안전함
    const attendanceDate = toKstDateString(now)

    // 4) 출석 insert
    const { error: insertError } = await session.supabase
      .from('attendance')
      .insert({
        user_id: session.profile.id,
        event_id: event.id,
        date: attendanceDate,
        status: attendanceStatus,
        method: 'qr',
        check_time: now.toISOString(),
      })

    if (insertError) {
      console.error('[attendance/check] insert error:', insertError)

      const message = insertError.message?.toLowerCase() ?? ''
      const code = insertError.code ?? ''

      // unique(user_id, event_id, date) 충돌
      if (
        code === '23505' ||
        message.includes('duplicate') ||
        message.includes('unique')
      ) {
        return jsonNoStore<AttendanceCheckResponse>(
          { error: '이미 출석 처리되었습니다.' },
          { status: 409 }
        )
      }

      return jsonNoStore<AttendanceCheckResponse>(
        { error: '출석 처리에 실패했습니다.' },
        { status: 500 }
      )
    }

    return jsonNoStore<AttendanceCheckResponse>({
      success: true,
      status: attendanceStatus,
      event_id: event.id,
      check_time: now.toISOString(),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    console.error('[attendance/check] unexpected error:', error)
    return jsonNoStore<AttendanceCheckResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
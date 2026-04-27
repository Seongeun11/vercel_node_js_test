// app/api/attendance/check/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { getSessionProfile } from '@/lib/server-session'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'
import { hashQrToken } from '@/lib/security/qr-token'
import { checkRateLimit } from '@/lib/rate-limit'

type AttendanceStatus = 'present' | 'late'

type AttendanceCheckResponse = {
  success?: boolean
  status?: AttendanceStatus
  event_id?: string
  occurrence_id?: string
  check_time?: string
  attendance_date?: string
  check_time_kst?: string
  already_checked?: boolean
  error?: string
}

type AttendanceCheckRequest = {
  token?: string
}

type FastAttendanceResult = {
  attendance_id: string
  event_id: string
  occurrence_id: string
  attendance_date: string
  status: string
  check_time: string
  already_checked: boolean
}

function isAttendanceStatus(status: string): status is AttendanceStatus {
  return status === 'present' || status === 'late'
}

function toKstDateTimeString(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

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

export async function POST(request: NextRequest): Promise<Response> {
  const startedAt = performance.now()

  try {
    assertSameOrigin(request)

    // 1. 로그인/권한 확인
    const session = await getSessionProfile(['trainee'])

    if (!session.ok) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 2. Rate Limit
    const rateLimit = await checkRateLimit(
      `attendance-check:user:${session.profile.id}`,
      10,
      60
    )

    if (!rateLimit.ok) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.resetInSeconds),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.resetInSeconds),
          },
        }
      )
    }

    // 3. 요청 body 검증
    const body = (await request.json()) as AttendanceCheckRequest
    const token = typeof body?.token === 'string' ? body.token.trim() : ''

    if (!token) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: 'QR 토큰이 필요합니다.' },
        { status: 400 }
      )
    }

    const now = new Date()
    const tokenHash = hashQrToken(token)

    // 4. QR 검증 + 회차 검증 + 중복 체크 + 출석 저장을 RPC 1회로 처리
    const { data, error } = await supabaseAdmin.rpc(
      'check_qr_attendance_fast',
      {
        p_user_id: session.profile.id,
        p_token_hash: tokenHash,
        p_check_time: now.toISOString(),
      }
    )

    if (error) {
      const message = error.message?.toLowerCase() ?? ''
      const code = error.code ?? ''
      if (message.includes('attendance_target_not_allowed')) {
        return jsonNoStore<AttendanceCheckResponse>(
          { error: '재학 상태의 수련생만 출석할 수 있습니다.' },
          { status: 403 }
        )
      }
      if (message.includes('invalid_or_expired_qr')) {
        return jsonNoStore<AttendanceCheckResponse>(
          { error: '유효하지 않거나 만료된 QR입니다.' },
          { status: 410 }
        )
      }

      if (
        code === '23505' ||
        message.includes('duplicate') ||
        message.includes('unique')
      ) {
        return jsonNoStore<AttendanceCheckResponse>(
          { error: '이미 오늘 출석 처리되었습니다.' },
          { status: 409 }
        )
      }

      console.error('[attendance/check] fast rpc error:', error)

      return jsonNoStore<AttendanceCheckResponse>(
        { error: '출석 처리에 실패했습니다.' },
        { status: 500 }
      )
    }

    const result = Array.isArray(data)
      ? (data[0] as FastAttendanceResult | undefined)
      : (data as FastAttendanceResult | undefined)

    if (!result) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '출석 처리 결과를 찾을 수 없습니다.' },
        { status: 500 }
      )
    }

    if (!isAttendanceStatus(result.status)) {
      console.error('[attendance/check] invalid status:', result.status)

      return jsonNoStore<AttendanceCheckResponse>(
        { error: '출석 상태값이 올바르지 않습니다.' },
        { status: 500 }
      )
    }

    const checkTime = new Date(result.check_time)

    console.log(
      '[attendance/check] elapsed:',
      Math.round(performance.now() - startedAt),
      'ms'
    )

    // 5. 성공 응답
    return jsonNoStore<AttendanceCheckResponse>({
      success: true,
      status: result.status,
      event_id: result.event_id,
      occurrence_id: result.occurrence_id,
      check_time: result.check_time,
      attendance_date: result.attendance_date,
      check_time_kst: toKstDateTimeString(checkTime),
      already_checked: Boolean(result.already_checked),
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
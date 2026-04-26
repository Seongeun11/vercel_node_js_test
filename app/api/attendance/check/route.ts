// app/api/attendance/check/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { getSessionProfile } from '@/lib/server-session'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'
import { hashQrToken } from '@/lib/security/qr-token'
import { checkRateLimit } from '@/lib/rate-limit'


type AttendanceCheckResponse = {
  success?: boolean
  status?: 'present' | 'late'
  event_id?: string
  occurrence_id?: string
  check_time?: string
  attendance_date?: string
  check_time_kst?: string
  error?: string
}

type AttendanceCheckRequest = {
  token?: string
}

function toKstDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function toKstDateTimeString(date: Date): string {
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
  try {
    assertSameOrigin(request)

    const session = await getSessionProfile(['trainee'])
    if (!session.ok) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '인증이 필요합니다.' },
      { status: 401 }
      )
    }
    /**
     * 출석 체크 Rate Limit
     * - 사용자 ID 기준
     * - 1분에 최대 10회
     * - QR 토큰 검증/DB 조회 전에 차단하여 서버 부하 방지
     */
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
    const body = (await request.json()) as AttendanceCheckRequest
    //const token = typeof body?.token === 'string' ? body.token.trim() : ''
    // 요청 토큰
    const token = typeof body?.token === 'string' ? body.token.trim() : ''

    if (!token) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: 'QR 토큰이 필요합니다.' },
        { status: 400 }
      )
    }

    const now = new Date()
    const attendanceDate = toKstDateString(now)
    const tokenHash = hashQrToken(token)
    // 1) QR 토큰 검증: 이제 occurrence_id 기준이 핵심
    const { data: qrToken, error: qrError } = await supabaseAdmin
      .from('qr_tokens')
      .select('id, event_id, occurrence_id, expires_at, deleted_at')
      .eq('token_hash', tokenHash)
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

    if (!qrToken.occurrence_id) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '회차 기반 QR이 아닙니다. 마이그레이션이 필요합니다.' },
        { status: 400 }
      )
    }
// expires_at이 null이면 무제한 QR로 간주합니다.
// 값이 있을 때만 만료 시간을 검사합니다.
  if (qrToken.expires_at) {
    const expiresAt = new Date(qrToken.expires_at)

    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '만료된 QR입니다.' },
        { status: 410 }
      )
    }
  }
    // 2) 회차 + 이벤트 조회
    const { data: occurrence, error: occurrenceError } = await session.supabase
      .from('event_occurrences')
      .select(`
        id,
        event_id,
        occurrence_date,
        start_time,
        status,
        events (
          id,
          start_time,
          late_threshold_min,
          deleted_at
        )
      `)
      .eq('id', qrToken.occurrence_id)
      .maybeSingle()

    if (occurrenceError) {
      console.error('[attendance/check] occurrence query error:', occurrenceError)
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '회차 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    if (!occurrence) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '출석 회차를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (occurrence.status === 'closed' || occurrence.status === 'archived') {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '종료된 출석 회차입니다.' },
        { status: 400 }
      )
    }

    const event = Array.isArray(occurrence.events)
      ? occurrence.events[0]
      : occurrence.events

    if (!event || event.deleted_at) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '행사를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (occurrence.occurrence_date > attendanceDate) {
    return jsonNoStore<AttendanceCheckResponse>(
      { error: '아직 시작되지 않은 회차입니다.' },
      { status: 400 }
    )
  }

    // 4) 출석 상태 계산: 회차 start_time 기준
    const startTime = new Date(occurrence.start_time)
    if (Number.isNaN(startTime.getTime())) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '회차 시작 시간이 올바르지 않습니다.' },
        { status: 500 }
      )
    }

    const lateThresholdMin =
      typeof event.late_threshold_min === 'number'
        ? event.late_threshold_min
        : 5

    const lateDeadline = new Date(
      startTime.getTime() + lateThresholdMin * 60_000
    )

    const attendanceStatus: 'present' | 'late' =
      now > lateDeadline ? 'late' : 'present'

    // 5) 중복 체크: user_id + occurrence_id 기준
    const { data: existingAttendance, error: existingAttendanceError } =
      await session.supabase
        .from('attendance')
        .select('id, status')
        .eq('user_id', session.profile.id)
        .eq('occurrence_id', occurrence.id)
        .maybeSingle()

    if (existingAttendanceError) {
      /*console.error(
        '[attendance/check] existing attendance query error:',
        existingAttendanceError
      )*/
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '기존 출석 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    if (existingAttendance) {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '이미 오늘 출석 처리되었습니다.' },
        { status: 409 }
      )
    }

    // 6) 출석 insert: occurrence_id 기준
    const { error: insertError } = await session.supabase
      .from('attendance')
      .insert({
        user_id: session.profile.id,
        event_id: occurrence.event_id,      // 기존 컬럼과 공존
        occurrence_id: occurrence.id,       // 새 기준
        attendance_date: occurrence.occurrence_date,
        date: occurrence.occurrence_date,   // 기존 컬럼과 공존
        status: attendanceStatus,
        method: 'qr',
        check_time: now.toISOString(),
      })

    if (insertError) {
      //console.error('[attendance/check] insert error:', insertError)

      const message = insertError.message?.toLowerCase() ?? ''
      const code = insertError.code ?? ''

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

      return jsonNoStore<AttendanceCheckResponse>(
        { error: '출석 처리에 실패했습니다.' },
        { status: 500 }
      )
    }

    return jsonNoStore<AttendanceCheckResponse>({
      success: true,
      status: attendanceStatus,
      event_id: occurrence.event_id,
      occurrence_id: occurrence.id,
      check_time: now.toISOString(),
      attendance_date: occurrence.occurrence_date,
      check_time_kst: toKstDateTimeString(now),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<AttendanceCheckResponse>(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    //console.error('[attendance/check] unexpected error:', error)
    return jsonNoStore<AttendanceCheckResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
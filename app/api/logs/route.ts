// app/api/logs/route.ts
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type AttendanceLogRow = {
  id: string
  attendance_id: string | null
  changed_by: string | null
  before_value: Record<string, unknown> | null
  after_value: Record<string, unknown> | null
  changed_at: string
}

type ProfileRow = {
  id: string
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
}

type EventRow = {
  id: string
  name: string
  start_time?: string
}

type LogAction = 'create' | 'update' | 'correct' | 'mark_absent' | 'delete'

export async function GET(request: NextRequest) {
  try {
    // 민감한 admin 로그 조회 API이므로 same-origin 유지
    assertSameOrigin(request)

    // admin만 전체 감사 로그 조회 가능
    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    // GET 쿼리스트링 파싱
    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get('event_id')?.trim() ?? ''
    const targetUserId = searchParams.get('target_user_id')?.trim() ?? ''
    const changedBy = searchParams.get('changed_by')?.trim() ?? ''
    const dateFrom = searchParams.get('date_from')?.trim() ?? ''
    const dateTo = searchParams.get('date_to')?.trim() ?? ''
    const limit = Math.min(
      Math.max(Number(searchParams.get('limit') ?? 100), 1),
      500
    )

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/

    if (dateFrom && !dateRegex.test(dateFrom)) {
      return jsonNoStore(
        { error: 'date_from 형식이 올바르지 않습니다. (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    if (dateTo && !dateRegex.test(dateTo)) {
      return jsonNoStore(
        { error: 'date_to 형식이 올바르지 않습니다. (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    // 로그 기본 조회
    const { data: rawLogs, error: logsError } = await supabaseAdmin
      .from('attendance_logs')
      .select('id, attendance_id, changed_by, before_value, after_value, changed_at')
      .order('changed_at', { ascending: false })
      .limit(limit)

    if (logsError) {
      return jsonNoStore(
        { error: logsError.message },
        { status: 500 }
      )
    }

    const logs = (rawLogs ?? []) as AttendanceLogRow[]

    if (logs.length === 0) {
      return jsonNoStore({ items: [] }, { status: 200 })
    }

    // 관련 프로필 / 이벤트 ID 수집
    const changedByIds = new Set<string>()
    const targetUserIds = new Set<string>()
    const eventIds = new Set<string>()

    for (const log of logs) {
      if (log.changed_by) {
        changedByIds.add(log.changed_by)
      }

      const beforeUserId = String(log.before_value?.['user_id'] ?? '')
      const afterUserId = String(log.after_value?.['user_id'] ?? '')
      const beforeEventId = String(log.before_value?.['event_id'] ?? '')
      const afterEventId = String(log.after_value?.['event_id'] ?? '')

      if (beforeUserId) targetUserIds.add(beforeUserId)
      if (afterUserId) targetUserIds.add(afterUserId)
      if (beforeEventId) eventIds.add(beforeEventId)
      if (afterEventId) eventIds.add(afterEventId)
    }

    const allProfileIds = [...new Set([...changedByIds, ...targetUserIds])]
    const allEventIds = [...eventIds]

    const [
      { data: profilesData, error: profilesError },
      { data: eventsData, error: eventsError },
    ] = await Promise.all([
      allProfileIds.length > 0
        ? supabaseAdmin
            .from('profiles')
            .select('id, full_name, student_id, role')
            .in('id', allProfileIds)
        : Promise.resolve({ data: [], error: null }),
      allEventIds.length > 0
        ? supabaseAdmin
            .from('events')
            .select('id, name, start_time')
            .in('id', allEventIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (profilesError) {
      return jsonNoStore(
        { error: profilesError.message },
        { status: 500 }
      )
    }

    if (eventsError) {
      return jsonNoStore(
        { error: eventsError.message },
        { status: 500 }
      )
    }

    const profileMap = new Map<string, ProfileRow>()
    for (const profile of (profilesData ?? []) as ProfileRow[]) {
      profileMap.set(profile.id, profile)
    }

    const eventMap = new Map<string, EventRow>()
    for (const event of (eventsData ?? []) as EventRow[]) {
      eventMap.set(event.id, event)
    }

    // UI용 응답 형태 정규화
    const items = logs
      .map((log) => {
        const beforeUserId = String(log.before_value?.['user_id'] ?? '')
        const afterUserId = String(log.after_value?.['user_id'] ?? '')
        const beforeEventId = String(log.before_value?.['event_id'] ?? '')
        const afterEventId = String(log.after_value?.['event_id'] ?? '')
        const effectiveTargetUserId = afterUserId || beforeUserId
        const effectiveEventId = afterEventId || beforeEventId
        const effectiveDate = String(
          log.after_value?.['date'] ?? log.before_value?.['date'] ?? ''
        )

        const action = String(
          log.after_value?.['action'] ?? log.before_value?.['action'] ?? 'update'
        ) as LogAction

        const reasonRaw =
          log.after_value?.['reason'] ?? log.before_value?.['reason'] ?? null

        return {
          id: log.id,
          attendance_id: log.attendance_id,
          changed_by: log.changed_by,
          target_user_id: effectiveTargetUserId,
          event_id: effectiveEventId,
          date: effectiveDate,
          action,
          reason: typeof reasonRaw === 'string' ? reasonRaw : null,
          before_value: log.before_value ?? {},
          after_value: log.after_value ?? {},
          changed_at: log.changed_at,

          // UI에서 바로 쓰기 편하도록 메타 포함
          changed_by_profile: log.changed_by
            ? {
                id: log.changed_by,
                full_name: profileMap.get(log.changed_by)?.full_name ?? '알 수 없음',
                student_id: profileMap.get(log.changed_by)?.student_id ?? '-',
                role: profileMap.get(log.changed_by)?.role ?? 'trainee',
              }
            : null,

          target_user_profile: effectiveTargetUserId
            ? {
                id: effectiveTargetUserId,
                full_name:
                  profileMap.get(effectiveTargetUserId)?.full_name ?? '알 수 없음',
                student_id:
                  profileMap.get(effectiveTargetUserId)?.student_id ?? '-',
                role: profileMap.get(effectiveTargetUserId)?.role ?? 'trainee',
              }
            : null,

          event_meta: effectiveEventId
            ? {
                id: effectiveEventId,
                name: eventMap.get(effectiveEventId)?.name ?? '알 수 없음',
                start_time: eventMap.get(effectiveEventId)?.start_time ?? null,
              }
            : null,
        }
      })
      .filter((item) => {
        if (eventId && item.event_id !== eventId) return false
        if (targetUserId && item.target_user_id !== targetUserId) return false
        if (changedBy && item.changed_by !== changedBy) return false
        if (dateFrom && item.date && item.date < dateFrom) return false
        if (dateTo && item.date && item.date > dateTo) return false
        return true
      })

    return jsonNoStore({ items }, { status: 200 })
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('[GET_LOGS_ERROR]', error)
    }

    return jsonNoStore(
      { error: '로그 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
// app/api/logs/route.ts
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type LogsRequestBody = {
  event_id?: string
  date?: string
  limit?: number
}

type AttendanceLogRow = {
  id: string
  attendance_id: string | null
  changed_by: string | null
  before_value: any
  after_value: any
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

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
   
    // 1) 권한 체크
    const authResult = await requireRole(['admin'])

    if (!authResult.ok) {
      return jsonNoStore(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    // 2) 요청 파싱
    const body = (await request.json()) as LogsRequestBody

    const eventId = String(body.event_id || '').trim()
    const date = String(body.date || '').trim()
    const limit = Math.min(Math.max(Number(body.limit ?? 100), 1), 500)

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonNoStore(
        { error: 'date 형식이 올바르지 않습니다. (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    // 3) 로그 기본 조회
    let logsQuery = supabaseAdmin
      .from('attendance_logs')
      .select('id, attendance_id, changed_by, before_value, after_value, changed_at')
      .order('changed_at', { ascending: false })
      .limit(limit)

    const { data: rawLogs, error: logsError } = await logsQuery

    if (logsError) {
      return jsonNoStore(
        { error: logsError.message },
        { status: 500 }
      )
    }

    const logs = (rawLogs ?? []) as AttendanceLogRow[]

    if (logs.length === 0) {
      return jsonNoStore(
        {
          logs: [],
        },
        { status: 200 }
      )
    }

    // 4) changed_by / attendance 대상 user / event 정보 수집
    const changedByIds = new Set<string>()
    const targetUserIds = new Set<string>()
    const eventIds = new Set<string>()

    for (const log of logs) {
      if (log.changed_by) {
        changedByIds.add(log.changed_by)
      }

      const beforeUserId = log.before_value?.user_id
      const afterUserId = log.after_value?.user_id
      const beforeEventId = log.before_value?.event_id
      const afterEventId = log.after_value?.event_id

      if (beforeUserId) targetUserIds.add(String(beforeUserId))
      if (afterUserId) targetUserIds.add(String(afterUserId))
      if (beforeEventId) eventIds.add(String(beforeEventId))
      if (afterEventId) eventIds.add(String(afterEventId))
    }

    const allProfileIds = [...new Set([...changedByIds, ...targetUserIds])]
    const allEventIds = [...eventIds]

    const [{ data: profilesData, error: profilesError }, { data: eventsData, error: eventsError }] =
      await Promise.all([
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

    // 5) shape 정리 + 필터 적용
    const normalizedLogs = logs
      .map((log) => {
        const beforeUserId = log.before_value?.user_id
        const afterUserId = log.after_value?.user_id
        const beforeEventId = log.before_value?.event_id
        const afterEventId = log.after_value?.event_id
        const effectiveEventId = String(afterEventId || beforeEventId || '')
        const effectiveDate = String(
          log.after_value?.date || log.before_value?.date || ''
        )
        const effectiveTargetUserId = String(afterUserId || beforeUserId || '')

        return {
          id: log.id,
          attendance_id: log.attendance_id,
          changed_at: log.changed_at,
          changed_by: log.changed_by
            ? {
                id: log.changed_by,
                full_name: profileMap.get(log.changed_by)?.full_name ?? '알 수 없음',
                student_id: profileMap.get(log.changed_by)?.student_id ?? '-',
                role: profileMap.get(log.changed_by)?.role ?? 'trainee',
              }
            : null,
          target_user: effectiveTargetUserId
            ? {
                id: effectiveTargetUserId,
                full_name: profileMap.get(effectiveTargetUserId)?.full_name ?? '알 수 없음',
                student_id: profileMap.get(effectiveTargetUserId)?.student_id ?? '-',
                role: profileMap.get(effectiveTargetUserId)?.role ?? 'trainee',
              }
            : null,
          event: effectiveEventId
            ? {
                id: effectiveEventId,
                name: eventMap.get(effectiveEventId)?.name ?? '알 수 없음',
                start_time: eventMap.get(effectiveEventId)?.start_time ?? null,
              }
            : null,
          before_value: log.before_value ?? null,
          after_value: log.after_value ?? null,
          date: effectiveDate || null,
        }
      })
      .filter((log) => {
        if (eventId && log.event?.id !== eventId) {
          return false
        }

        if (date && log.date !== date) {
          return false
        }

        return true
      })

    return jsonNoStore(
      {
        logs: normalizedLogs,
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
  }
}
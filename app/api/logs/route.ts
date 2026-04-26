// app/api/logs/route.ts

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonNoStore } from '@/lib/security/api-response'

type LogAction = 'create' | 'update' | 'correct' | 'mark_absent' | 'delete'

type AttendanceLogRow = {
  id: string
  attendance_id: string | null
  changed_by: string | null
  target_user_id: string | null
  event_id: string | null
  date: string
  action: LogAction
  reason: string | null
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
  start_time: string | null
}

type LogsResponse = {
  items?: unknown[]
  error?: string
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? 100)

  if (!Number.isFinite(parsed)) return 100

  return Math.min(Math.max(Math.floor(parsed), 1), 500)
}

function isValidDateText(value: string): boolean {
  return DATE_REGEX.test(value)
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await requireRole(['admin'])

    if (!authResult.ok) {
      return jsonNoStore<LogsResponse>(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const searchParams = request.nextUrl.searchParams

    const eventId = searchParams.get('event_id')?.trim() ?? ''
    const targetUserId = searchParams.get('target_user_id')?.trim() ?? ''
    const changedBy = searchParams.get('changed_by')?.trim() ?? ''
    const action = searchParams.get('action')?.trim() as LogAction | ''
    const dateFrom = searchParams.get('date_from')?.trim() ?? ''
    const dateTo = searchParams.get('date_to')?.trim() ?? ''
    const limit = parseLimit(searchParams.get('limit'))

    if (dateFrom && !isValidDateText(dateFrom)) {
      return jsonNoStore<LogsResponse>(
        { error: 'date_from 형식이 올바르지 않습니다. (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    if (dateTo && !isValidDateText(dateTo)) {
      return jsonNoStore<LogsResponse>(
        { error: 'date_to 형식이 올바르지 않습니다. (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    if (dateFrom && dateTo && dateFrom > dateTo) {
      return jsonNoStore<LogsResponse>(
        { error: 'date_from은 date_to보다 늦을 수 없습니다.' },
        { status: 400 }
      )
    }

    if (
      action &&
      !['create', 'update', 'correct', 'mark_absent', 'delete'].includes(action)
    ) {
      return jsonNoStore<LogsResponse>(
        { error: 'action 값이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin
      .from('attendance_logs')
      .select(`
        id,
        attendance_id,
        changed_by,
        target_user_id,
        event_id,
        date,
        action,
        reason,
        before_value,
        after_value,
        changed_at
      `)
      .order('changed_at', { ascending: false })
      .limit(limit)

    /**
     * 필터는 DB 쿼리 단계에서 적용한다.
     * 최신 N개 조회 후 JS에서 필터링하면 결과 누락이 발생할 수 있다.
     */
    if (eventId) {
      query = query.eq('event_id', eventId)
    }

    if (targetUserId) {
      query = query.eq('target_user_id', targetUserId)
    }

    if (changedBy) {
      query = query.eq('changed_by', changedBy)
    }

    if (action) {
      query = query.eq('action', action)
    }

    if (dateFrom) {
      query = query.gte('date', dateFrom)
    }

    if (dateTo) {
      query = query.lte('date', dateTo)
    }

    const { data: rawLogs, error: logsError } = await query

    if (logsError) {
      console.error('[api/logs] logs query error:', logsError)

      return jsonNoStore<LogsResponse>(
        { error: '로그 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    const logs = (rawLogs ?? []) as AttendanceLogRow[]

    if (logs.length === 0) {
      return jsonNoStore<LogsResponse>(
        { items: [] },
        { status: 200 }
      )
    }

    const changedByIds = new Set<string>()
    const targetUserIds = new Set<string>()
    const eventIds = new Set<string>()

    for (const log of logs) {
      if (log.changed_by) changedByIds.add(log.changed_by)
      if (log.target_user_id) targetUserIds.add(log.target_user_id)
      if (log.event_id) eventIds.add(log.event_id)
    }

    const allProfileIds = Array.from(
      new Set([...changedByIds, ...targetUserIds])
    )
    const allEventIds = Array.from(eventIds)

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
      console.error('[api/logs] profiles query error:', profilesError)

      return jsonNoStore<LogsResponse>(
        { error: '사용자 정보를 불러오지 못했습니다.' },
        { status: 500 }
      )
    }

    if (eventsError) {
      console.error('[api/logs] events query error:', eventsError)

      return jsonNoStore<LogsResponse>(
        { error: '이벤트 정보를 불러오지 못했습니다.' },
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

    const items = logs.map((log) => ({
      id: log.id,
      attendance_id: log.attendance_id,
      changed_by: log.changed_by,
      target_user_id: log.target_user_id ?? '',
      event_id: log.event_id ?? '',
      date: log.date,
      action: log.action,
      reason: log.reason,
      before_value: log.before_value ?? {},
      after_value: log.after_value ?? {},
      changed_at: log.changed_at,

      changed_by_profile: log.changed_by
        ? {
            id: log.changed_by,
            full_name: profileMap.get(log.changed_by)?.full_name ?? '알 수 없음',
            student_id: profileMap.get(log.changed_by)?.student_id ?? '-',
            role: profileMap.get(log.changed_by)?.role ?? 'trainee',
          }
        : null,

      target_user_profile: log.target_user_id
        ? {
            id: log.target_user_id,
            full_name:
              profileMap.get(log.target_user_id)?.full_name ?? '알 수 없음',
            student_id:
              profileMap.get(log.target_user_id)?.student_id ?? '-',
            role: profileMap.get(log.target_user_id)?.role ?? 'trainee',
          }
        : null,

      event_meta: log.event_id
        ? {
            id: log.event_id,
            name: eventMap.get(log.event_id)?.name ?? '알 수 없음',
            start_time: eventMap.get(log.event_id)?.start_time ?? null,
          }
        : null,
    }))

    return jsonNoStore<LogsResponse>(
      { items },
      { status: 200 }
    )
  } catch (error) {
    console.error('[api/logs] unexpected error:', error)

    return jsonNoStore<LogsResponse>(
      { error: '로그 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
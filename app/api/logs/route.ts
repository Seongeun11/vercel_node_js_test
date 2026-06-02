import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonNoStore } from '@/lib/security/api-response'

type LogAction = 'create' | 'update' | 'correct' | 'mark_absent' | 'delete'

type LogsResponse = {
  items?: unknown[]
  error?: string
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const PROGRAM_ID_MAP: Record<string, number> = {
  academy: 1,
  spirituality: 2,
  mosim: 3,
  hujin: 4,
  seonghwa: 5,
  resonance: 6,
}

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
      return jsonNoStore<LogsResponse>({ error: authResult.error }, { status: authResult.status })
    }

    const searchParams = request.nextUrl.searchParams

    const programType = (searchParams.get('program_type') ?? 'academy').trim().toLowerCase()
    const affiliationId = PROGRAM_ID_MAP[programType]

    if (!affiliationId) {
      return jsonNoStore<LogsResponse>({ items: [] }, { status: 200 })
    }

    const eventId = searchParams.get('event_id')?.trim() ?? ''
    const targetUserId = searchParams.get('target_user_id')?.trim() ?? ''
    const changedBy = searchParams.get('changed_by')?.trim() ?? ''
    const action = searchParams.get('action')?.trim() as LogAction | ''
    const dateFrom = searchParams.get('date_from')?.trim() ?? ''
    const dateTo = searchParams.get('date_to')?.trim() ?? ''
    const limit = parseLimit(searchParams.get('limit'))

    if (dateFrom && !isValidDateText(dateFrom)) {
      return jsonNoStore<LogsResponse>({ error: 'date_from 형식이 올바르지 않습니다. (YYYY-MM-DD)' }, { status: 400 })
    }
    if (dateTo && !isValidDateText(dateTo)) {
      return jsonNoStore<LogsResponse>({ error: 'date_to 형식이 올바르지 않습니다. (YYYY-MM-DD)' }, { status: 400 })
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return jsonNoStore<LogsResponse>({ error: 'date_from은 date_to보다 늦을 수 없습니다.' }, { status: 400 })
    }
    if (action && !['create', 'update', 'correct', 'mark_absent', 'delete'].includes(action)) {
      return jsonNoStore<LogsResponse>({ error: 'action 값이 올바르지 않습니다.' }, { status: 400 })
    }

    // 🚀 [해결] .select() 내부의 # 주석을 완전히 제거하여 Supabase 파싱 오류를 원천 차단했습니다.
    let query = supabaseAdmin
      .from('attendance_logs')
      .select(`
        id,
        attendance_id,
        changed_by,
        target_user_id,
        event_id,
        attendance_date,
        action,
        reason,
        before_value,
        after_value,
        changed_at,
        target_user_profile:profiles!attendance_logs_target_user_id_fkey!inner(
          id,
          full_name,
          student_id,
          affiliation_id,
          roles(name)
        ),
        changed_by_profile:profiles!attendance_logs_changed_by_fkey(
          id,
          full_name,
          student_id,
          roles(name)
        ),
        event_meta:events(
          id,
          name,
          start_time
        )
      `)
      .order('changed_at', { ascending: false })
      .limit(limit)

    // 정확한 타겟 별칭 구조를 기반으로 조건 매핑 수행
    query = query.eq('target_user_profile.affiliation_id', affiliationId)

    if (eventId) query = query.eq('event_id', eventId)
    if (targetUserId) query = query.eq('target_user_id', targetUserId)
    if (changedBy) query = query.eq('changed_by', changedBy)
    if (action) query = query.eq('action', action)
    if (dateFrom) query = query.gte('attendance_date', dateFrom)
    if (dateTo) query = query.lte('attendance_date', dateTo)

    const { data: rawLogs, error: logsError } = await query

    if (logsError) {
      console.error('[api/logs] logs query error:', logsError)
      return jsonNoStore<LogsResponse>({ error: '로그 조회에 실패했습니다.' }, { status: 500 })
    }

    const items = (rawLogs ?? []).map((log: any) => ({
      id: log.id,
      attendance_id: log.attendance_id,
      changed_by: log.changed_by,
      target_user_id: log.target_user_id ?? '',
      event_id: log.event_id ?? '',
      attendance_date: log.attendance_date,
      action: log.action,
      reason: log.reason,
      before_value: log.before_value ?? {},
      after_value: log.after_value ?? {},
      changed_at: log.changed_at,

      changed_by_profile: log.changed_by_profile
        ? {
            id: log.changed_by_profile.id,
            full_name: log.changed_by_profile.full_name ?? '알 수 없음',
            student_id: log.changed_by_profile.student_id ?? '-',
            role: (log.changed_by_profile.roles?.name ?? 'trainee') as 'admin' | 'captain' | 'trainee',
          }
        : null,

      target_user_profile: log.target_user_profile
        ? {
            id: log.target_user_profile.id,
            full_name: log.target_user_profile.full_name ?? '알 수 없음',
            student_id: log.target_user_profile.student_id ?? '-',
            role: (log.target_user_profile.roles?.name ?? 'trainee') as 'admin' | 'captain' | 'trainee',
          }
        : null,

      event_meta: log.event_meta
        ? {
            id: log.event_meta.id,
            name: log.event_meta.name ?? '알 수 없음',
            start_time: log.event_meta.start_time ?? null,
          }
        : null,
    }))

    return jsonNoStore<LogsResponse>({ items }, { status: 200 })
  } catch (error) {
    console.error('[api/logs] unexpected error:', error)
    return jsonNoStore<LogsResponse>({ error: '로그 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
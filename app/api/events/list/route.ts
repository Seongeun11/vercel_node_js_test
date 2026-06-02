// app/api/event/list/route.ts
import { NextRequest } from 'next/server'
import { getSessionProfile } from '@/lib/server-session'
import { jsonNoStore } from '@/lib/security/api-response'

type WeekdayCode = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

type EventItem = {
  id: string
  name: string
  start_time: string
  late_threshold_min: number
  allow_duplicate_check: boolean
  is_special_event: boolean
  recurrence_type: 'none' | 'daily'
  recurrence_days: WeekdayCode[]
  is_active: boolean
  created_at: string
  updated_at: string
}

type eventListResponse = {
  items?: EventItem[]
  error?: string
}

function parseBooleanParam(value: string | null): boolean | null {
  if (value === null) return null
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

export async function GET(request: NextRequest): Promise<Response> {
  const session = await getSessionProfile(['admin'])

  if (!session.ok) {
    return jsonNoStore<eventListResponse>(
      { error: '인증이 필요합니다.' },
      { status: 401 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const upcomingOnly = parseBooleanParam(searchParams.get('upcoming_only')) ?? false
  const nowIso = new Date().toISOString()

  // 성능 최적화: 불필요한 조인이나 부재하는 program_type 필드 접근을 원천 차단
  let query = session.supabase
    .from('event')
    .select(`
      id,
      name,
      start_time,
      late_threshold_min,
      allow_duplicate_check,
      is_special_event,
      recurrence_type,
      recurrence_days,
      is_active,
      created_at,
      updated_at
    `)
    .is('deleted_at', null)

  if (upcomingOnly) {
    query = query.gte('start_time', nowIso)
  }

  const { data, error } = await query.order('start_time', {
    ascending: upcomingOnly,
  })

  if (error) {
    console.error('[event/list] query error:', error)
    return jsonNoStore<eventListResponse>(
      { error: '행사 목록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }

  const items = (data ?? []) as EventItem[]
  return jsonNoStore<eventListResponse>({ items })
}
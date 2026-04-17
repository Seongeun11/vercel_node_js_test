// app/api/events/list/route.ts
import { NextRequest } from 'next/server'
import { getSessionProfile } from '@/lib/server-session'
import { jsonNoStore } from '@/lib/security/api-response'

type EventItem = {
  id: string
  name: string
  start_time: string
  late_threshold_min: number
  allow_duplicate_check: boolean
  is_special_event: boolean
  created_at: string
  updated_at: string
}

type EventsListResponse = {
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
  const session = await getSessionProfile()

  if (!session.ok) {
    return jsonNoStore<EventsListResponse>(
      { error: session.error },
      { status: session.status }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const upcomingOnly = parseBooleanParam(searchParams.get('upcoming_only')) ?? false
  const nowIso = new Date().toISOString()

  let query = session.supabase
    .from('events')
    .select(`
      id,
      name,
      start_time,
      late_threshold_min,
      allow_duplicate_check,
      is_special_event,
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
    console.error('[events/list] query error:', error)
    return jsonNoStore<EventsListResponse>(
      { error: '이벤트 목록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }

  return jsonNoStore<EventsListResponse>({
    items: (data ?? []).map((event) => ({
      id: event.id,
      name: event.name,
      start_time: event.start_time,
      late_threshold_min: event.late_threshold_min,
      allow_duplicate_check: event.allow_duplicate_check,
      created_at: event.created_at,
      updated_at: event.updated_at,
      is_special_event: event.is_special_event,
    })),
  })
}
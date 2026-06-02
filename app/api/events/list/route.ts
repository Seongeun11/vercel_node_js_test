// app/api/events/list/route.ts
import { NextRequest } from 'next/server'
import { getSessionProfile } from '@/lib/server-session' // 내부적으로 getUser()를 쓰도록 수정되었음을 전제, 혹은 아래 직렬 검증
import { jsonNoStore } from '@/lib/security/api-response'

type WeekdayCode = 'sun'|'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

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
  //getSessionProfile 내부가 getUser() 기반으로 동작
  const session = await getSessionProfile(['admin'])

  if (!session.ok) {
    return jsonNoStore<EventsListResponse>(
      { error: '인증이 필요합니다.' },
      { status: 401 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const upcomingOnly = parseBooleanParam(searchParams.get('upcoming_only')) ?? false
  const nowIso = new Date().toISOString()

  // 2. 성능 최적화: 수많은 데이터를 자바스크립트 map 연산으로 재가공하지 않도록
  // 필요한 데이터 포맷 그대로 select해 오거나 최소한의 가공만 거칩니다.
  let query = session.supabase
    .from('events')
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

  // 3. 성능 최적화: 정렬 방향에 최적화된 DB 인덱스를 타도록 구성
  // (Supabase dashboard에서 start_time 기준 인덱스를 꼭 생성해 주세요)
  const { data, error } = await query.order('start_time', {
    ascending: upcomingOnly,
  })

  if (error) {
    console.error('[events/list] query error:', error)
    return jsonNoStore<EventsListResponse>(
      { error: '행사 목록 조회에 실패했습니다.' },
      { status: 500 }
    )
  }

  // 4. 성능 최적화: 불필요한 고비용 배열 헬퍼 루프 연산(normalizeRecurrenceDays) 전면 제거
  // 데이터가 DB에 정상적으로 들어있다면 타입 단언(Type Assertion)만으로 즉시 응답 가능 -> CPU 연산 시간 대폭 감소
  const items = (data ?? []) as EventItem[]

  return jsonNoStore<EventsListResponse>({ items })
}
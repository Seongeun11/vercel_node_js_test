// app/api/events/create/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type RecurrenceType = 'none' | 'daily'
type WeekdayCode = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

type CreateEventBody = {
  name?: string
  start_time?: string
  late_threshold_min?: number
  allow_duplicate_check?: boolean
  is_special_event?: boolean
  recurrence_type?: RecurrenceType
  recurrence_days?: string[]
  is_active?: boolean
  affiliations_id?: string | number | null
}

type CreateEventResponse = {
  message?: string
  event?: {
    id: string
    name: string
    start_time: string
    late_threshold_min: number
    allow_duplicate_check: boolean
    is_special_event: boolean
    recurrence_type: RecurrenceType
    recurrence_days: WeekdayCode[]
    is_active: boolean
    created_at: string
    affiliations_id: number | null
  }
  error?: string
}

const ALLOWED_WEEKDAYS: WeekdayCode[] = [
  'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'
]

function hasOnlyAllowedWeekdays(input: unknown): boolean {
  if (!Array.isArray(input)) return false
  return input.every((value) =>
    ALLOWED_WEEKDAYS.includes(String(value).trim().toLowerCase() as WeekdayCode)
  )
}

function normalizeRecurrenceDays(input: unknown): WeekdayCode[] {
  if (!Array.isArray(input)) return []
  const normalized = input
    .map((value) => String(value).trim().toLowerCase())
    .filter((value): value is WeekdayCode =>
      ALLOWED_WEEKDAYS.includes(value as WeekdayCode)
    )
  const unique = Array.from(new Set(normalized))
  return ALLOWED_WEEKDAYS.filter((day) => unique.includes(day))
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore<CreateEventResponse>(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as CreateEventBody

    const name = String(body.name ?? '').trim()
    const startTimeRaw = String(body.start_time ?? '').trim()
    const lateThresholdMin = Number(body.late_threshold_min ?? 5)
    const allowDuplicateCheck = Boolean(body.allow_duplicate_check)
    const isSpecialEvent = Boolean(body.is_special_event)
    const isActive = body.is_active ?? true

    let parsedAffiliationsId: number | null = null
    if (body.affiliations_id !== undefined && body.affiliations_id !== null && String(body.affiliations_id).trim() !== '') {
      parsedAffiliationsId = Number(body.affiliations_id)
      if (Number.isNaN(parsedAffiliationsId)) {
        parsedAffiliationsId = null
      }
    }

    if (!name) {
      return jsonNoStore<CreateEventResponse>({ error: '행사명을 입력해주세요.' }, { status: 400 })
    }

    if (!startTimeRaw) {
      return jsonNoStore<CreateEventResponse>({ error: '시작 시간을 입력해주세요.' }, { status: 400 })
    }

    const startTime = new Date(startTimeRaw)
    if (Number.isNaN(startTime.getTime())) {
      return jsonNoStore<CreateEventResponse>({ error: '시작 시간 형식이 올바르지 않습니다.' }, { status: 400 })
    }

    if (!Number.isFinite(lateThresholdMin) || lateThresholdMin < 0 || lateThresholdMin > 180) {
      return jsonNoStore<CreateEventResponse>({ error: '지각 기준은 0~180분 사이여야 합니다.' }, { status: 400 })
    }

    if (body.recurrence_days !== undefined && !hasOnlyAllowedWeekdays(body.recurrence_days)) {
      return jsonNoStore<CreateEventResponse>({ error: '반복 요일 값이 올바르지 않습니다.' }, { status: 400 })
    }

    const recurrenceDays = normalizeRecurrenceDays(body.recurrence_days)
    const recurrenceType: RecurrenceType = recurrenceDays.length > 0 ? 'daily' : 'none'

    // 1. 이벤트 마스터 레코드 데이터베이스 삽입
    const { data: createdEvent, error } = await supabaseAdmin
      .from('events')
      .insert({
        name,
        start_time: startTime.toISOString(),
        late_threshold_min: lateThresholdMin,
        allow_duplicate_check: allowDuplicateCheck,
        is_special_event: isSpecialEvent,
        recurrence_type: recurrenceType,
        recurrence_days: recurrenceDays,
        is_active: Boolean(isActive),
        affiliations_id: parsedAffiliationsId,
      })
      .select('id, name, start_time, late_threshold_min, allow_duplicate_check, is_special_event, recurrence_type, recurrence_days, is_active, created_at, affiliations_id')
      .single()

    if (error || !createdEvent) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[events/create] insert error:', error)
      }
      return jsonNoStore<CreateEventResponse>({ error: error?.message || '행사 생성에 실패했습니다.' }, { status: 500 })
    }

    // 2. [논리 교정 핵심] DB 함수(RPC) 호출을 통해 단발성/정기 행사 오늘 자 회차 동기화 위임 처리
    // 앞서 만든 'sync_today_event_occurrences' SQL 함수를 원격 실행합니다.
    const { error: rpcError } = await supabaseAdmin.rpc('fn_create_today_occurrences')

    if (rpcError) {
      console.error('[events/create] rpc sync error:', rpcError)
      // 사용자 경험을 위해 행사는 만들어졌으므로 에러로 튕구기보단 경고 메시지 형태를 권장하나, 
      // 완벽한 트랜잭션을 원한다면 아래처럼 500 에러를 반환할 수 있습니다.
      return jsonNoStore<CreateEventResponse>(
        { error: '행사는 생성되었으나 출석판 자동 동기화에 실패했습니다. 관리자 화면에서 동기화를 눌러주세요.' },
        { status: 500 }
      )
    }

    return jsonNoStore<CreateEventResponse>(
      {
        message: '행사가 생성되었습니다.',
        event: {
          ...createdEvent,
          recurrence_days: createdEvent.recurrence_days ?? [],
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<CreateEventResponse>({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
    }
    if (process.env.NODE_ENV !== 'production') {
      console.error('[events/create] unexpected error:', error)
    }
    return jsonNoStore<CreateEventResponse>({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
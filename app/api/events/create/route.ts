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
  }
  error?: string
}

// 프론트엔드(eventsClient.tsx) 시퀀스와 동일하게 일요일(sun)부터 시작하도록 순서 동기화
const ALLOWED_WEEKDAYS: WeekdayCode[] = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
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

  // 항상 일~토 순서로 정렬하여 프론트엔드 데이터 바인딩과 통일성 유지
  return ALLOWED_WEEKDAYS.filter((day) => unique.includes(day))
}

const SEOUL_TIME_ZONE = 'Asia/Seoul'

/**
 * 런타임 환경에 독립적이며, 하이픈 형식을 엄격하게 보장하는 KST Date 변환 함수
 */
function getKstDateString(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  // 각 날짜 파트를 안전하게 토큰으로 분할하여 런타임 별 포맷 파편화 방지
  const parts = formatter.formatToParts(date)
  const year = parts.find((p) => p.type === 'year')?.value || '1970'
  const month = parts.find((p) => p.type === 'month')?.value || '01'
  const day = parts.find((p) => p.type === 'day')?.value || '01'

  return `${year}-${month}-${day}`
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

    if (!name) {
      return jsonNoStore<CreateEventResponse>(
        { error: '행사명을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!startTimeRaw) {
      return jsonNoStore<CreateEventResponse>(
        { error: '시작 시간을 입력해주세요.' },
        { status: 400 }
      )
    }

    const startTime = new Date(startTimeRaw)

    if (Number.isNaN(startTime.getTime())) {
      return jsonNoStore<CreateEventResponse>(
        { error: '시작 시간 형식이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    if (
      !Number.isFinite(lateThresholdMin) ||
      lateThresholdMin < 0 ||
      lateThresholdMin > 180
    ) {
      return jsonNoStore<CreateEventResponse>(
        { error: '지각 기준은 0~180분 사이여야 합니다.' },
        { status: 400 }
      )
    }

    if (
      body.recurrence_days !== undefined &&
      !hasOnlyAllowedWeekdays(body.recurrence_days)
    ) {
      return jsonNoStore<CreateEventResponse>(
        { error: '반복 요일 값이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    const recurrenceDays = normalizeRecurrenceDays(body.recurrence_days)
    const recurrenceType: RecurrenceType =
      recurrenceDays.length > 0 ? 'daily' : 'none'

    // 1. 이벤트 마스터 레코드 삽입
    const { data: createdEvent, error } = await supabaseAdmin
      .from('events')
      .insert({
        name,
        start_time: startTime.toISOString(),
        late_threshold_min: lateThresholdMin,
        allow_duplicate_check: allowDuplicateCheck,
        is_special_event: isSpecialEvent,
        recurrence_type: recurrenceType,
        recurrence_days: recurrenceDays, // PostgreSQL의 _text 타입으로 안전하게 삽입됨
        is_active: Boolean(isActive),
      })
      .select(
        'id, name, start_time, late_threshold_min, allow_duplicate_check, is_special_event, recurrence_type, recurrence_days, is_active, created_at'
      )
      .single()

    if (error || !createdEvent) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[events/create] insert error:', error)
      }

      return jsonNoStore<CreateEventResponse>(
        { error: error?.message || '행사 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 2. 단발성 행사인 경우 당일 실시간 출석판 노출을 위한 회차(occurrence) 즉시 생성
    if (recurrenceType === 'none') {
      const occurrenceDate = getKstDateString(startTime) // 'YYYY-MM-DD' 형식 절대 보장

      const { error: occurrenceError } = await supabaseAdmin
        .from('event_occurrences')
        .insert({
          event_id: createdEvent.id,
          occurrence_date: occurrenceDate, // date 타입 컬럼에 정상 바인딩
          start_time: startTime.toISOString(),
          status: 'open',
        })

      if (occurrenceError) {
        console.error('[events/create] occurrence insert error:', occurrenceError)

        return jsonNoStore<CreateEventResponse>(
          { error: '행사는 생성되었지만 출석 회차 생성에 실패했습니다.' },
          { status: 500 }
        )
      }
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
      return jsonNoStore<CreateEventResponse>(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('[events/create] unexpected error:', error)
    }

    return jsonNoStore<CreateEventResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
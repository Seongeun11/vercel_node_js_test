// app/api/events/create/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type RecurrenceType = 'none' | 'daily'
type WeekdayCode = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

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

const ALLOWED_WEEKDAYS: WeekdayCode[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
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

  // 항상 월~일 순서로 저장
  return ALLOWED_WEEKDAYS.filter((day) => unique.includes(day))
}

const SEOUL_TIME_ZONE = 'Asia/Seoul'

function getKstDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
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

    const { data: createdEvent, error } = await supabaseAdmin
      .from('events')
      .insert({
        name,
        start_time: startTime.toISOString(),
        late_threshold_min: lateThresholdMin,
        allow_duplicate_check: allowDuplicateCheck,
        is_special_event: isSpecialEvent,
        recurrence_type: recurrenceType, // 기존 호환 유지
        recurrence_days: recurrenceDays, // 새 컬럼 저장
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
    // 반복 없는 단발 행사는 행사 시작일에 해당하는 회차를 즉시 생성한다.
    // 특히 시작일이 오늘이면 /admin/admin-only/attendance-today 에 바로 표시된다.
    if (recurrenceType === 'none') {
      const occurrenceDate = getKstDateString(startTime)

      const { error: occurrenceError } = await supabaseAdmin
        .from('event_occurrences')
        .insert({
          event_id: createdEvent.id,
          occurrence_date: occurrenceDate,
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
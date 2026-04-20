// app/api/event-occurrences/ensure-today/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type WeekdayCode = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
type RecurrenceType = 'none' | 'daily'

type EventRow = {
  id: string
  start_time: string
  recurrence_type: RecurrenceType
  recurrence_days: WeekdayCode[] | null
  is_active: boolean
}

type EventOccurrenceRow = {
  id: string
  event_id: string
  occurrence_date: string
}

type EnsureTodayResponse = {
  date?: string
  weekday?: WeekdayCode
  created_count?: number
  skipped_count?: number
  failed_count?: number
  created_event_ids?: string[]
  error?: string
}

function getKstTodayDateString(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(date)
}

function getKstWeekdayCode(date = new Date()): WeekdayCode {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  }).format(date)

  switch (weekday.toLowerCase()) {
    case 'mon':
      return 'mon'
    case 'tue':
      return 'tue'
    case 'wed':
      return 'wed'
    case 'thu':
      return 'thu'
    case 'fri':
      return 'fri'
    case 'sat':
      return 'sat'
    case 'sun':
      return 'sun'
    default:
      return 'mon'
  }
}

function extractKstTimeParts(isoString: string): { hour: string; minute: string; second: string } {
  const date = new Date(isoString)

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  const second = parts.find((part) => part.type === 'second')?.value ?? '00'

  return { hour, minute, second }
}

function buildOccurrenceStartTime(todayKstDate: string, eventStartTimeIso: string): string {
  const { hour, minute, second } = extractKstTimeParts(eventStartTimeIso)

  // KST 기준 오늘 날짜 + 이벤트의 시/분/초를 합쳐 ISO 문자열 생성
  return `${todayKstDate}T${hour}:${minute}:${second}+09:00`
}

function normalizeDays(days: WeekdayCode[] | null | undefined): WeekdayCode[] {
  if (!Array.isArray(days)) return []

  const allowed: WeekdayCode[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const unique = Array.from(
    new Set(
      days
        .map((day) => String(day).trim().toLowerCase())
        .filter((day): day is WeekdayCode => allowed.includes(day as WeekdayCode))
    )
  )

  return allowed.filter((day) => unique.includes(day))
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore<EnsureTodayResponse>(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const todayKstDate = getKstTodayDateString()
    const todayWeekday = getKstWeekdayCode()

    // 1) 활성 이벤트 로드
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('id, start_time, recurrence_type, recurrence_days, is_active')
      .eq('is_active', true)

    if (eventsError) {
      console.error('[event-occurrences/ensure-today] events query error:', eventsError)

      return jsonNoStore<EnsureTodayResponse>(
        { error: '이벤트 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    const eventRows = Array.isArray(events) ? (events as EventRow[]) : []

    // 2) 오늘 요일에 해당하는 이벤트만 필터링
    //    - 새 구조: recurrence_days 포함
    //    - 과도기 호환: recurrence_type === 'daily'
    const targetEvents = eventRows.filter((event) => {
      const recurrenceDays = normalizeDays(event.recurrence_days)
      const matchesWeekday = recurrenceDays.includes(todayWeekday)
      const matchesLegacyDaily =
        recurrenceDays.length === 0 && event.recurrence_type === 'daily'

      return matchesWeekday || matchesLegacyDaily
    })

    if (targetEvents.length === 0) {
      return jsonNoStore<EnsureTodayResponse>({
        date: todayKstDate,
        weekday: todayWeekday,
        created_count: 0,
        skipped_count: 0,
        failed_count: 0,
        created_event_ids: [],
      })
    }

    // 3) 이미 오늘 생성된 회차 조회
    const targetEventIds = targetEvents.map((event) => event.id)

    const { data: existingOccurrences, error: existingError } = await supabaseAdmin
      .from('event_occurrences')
      .select('id, event_id, occurrence_date')
      .eq('occurrence_date', todayKstDate)
      .in('event_id', targetEventIds)

    if (existingError) {
      console.error('[event-occurrences/ensure-today] existing occurrence query error:', existingError)

      return jsonNoStore<EnsureTodayResponse>(
        { error: '기존 회차 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    const existingRows = Array.isArray(existingOccurrences)
      ? (existingOccurrences as EventOccurrenceRow[])
      : []

    const existingEventIdSet = new Set(existingRows.map((row) => row.event_id))

    const rowsToInsert = targetEvents
      .filter((event) => !existingEventIdSet.has(event.id))
      .map((event) => ({
        event_id: event.id,
        occurrence_date: todayKstDate,
        start_time: buildOccurrenceStartTime(todayKstDate, event.start_time),
        end_time: null,
        status: 'scheduled',
      }))

    if (rowsToInsert.length === 0) {
      return jsonNoStore<EnsureTodayResponse>({
        date: todayKstDate,
        weekday: todayWeekday,
        created_count: 0,
        skipped_count: targetEvents.length,
        failed_count: 0,
        created_event_ids: [],
      })
    }

    const { data: createdRows, error: insertError } = await supabaseAdmin
      .from('event_occurrences')
      .insert(rowsToInsert)
      .select('id, event_id, occurrence_date')

    if (insertError) {
      console.error('[event-occurrences/ensure-today] insert error:', insertError)

      return jsonNoStore<EnsureTodayResponse>(
        { error: '오늘 회차 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    const createdEventIds = Array.isArray(createdRows)
      ? createdRows.map((row) => row.event_id)
      : []

    return jsonNoStore<EnsureTodayResponse>({
      date: todayKstDate,
      weekday: todayWeekday,
      created_count: createdEventIds.length,
      skipped_count: targetEvents.length - createdEventIds.length,
      failed_count: 0,
      created_event_ids: createdEventIds,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<EnsureTodayResponse>(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    console.error('[event-occurrences/ensure-today] unexpected error:', error)

    return jsonNoStore<EnsureTodayResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
// app/api/event-occurrences/ensure-today/today/route.ts
// 화면 표시전 최종필터
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonNoStore } from '@/lib/security/api-response'

type WeekdayCode = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
type RecurrenceType = 'none' | 'daily'
type OccurrenceStatus = 'scheduled' | 'open' | 'closed' | 'archived'

type TodayOccurrenceItem = {
  id: string
  event_id: string
  occurrence_date: string
  start_time: string
  end_time: string | null
  status: OccurrenceStatus
  created_at: string
  updated_at: string
  events: {
    id: string
    name: string
    start_time: string
    late_threshold_min: number
    allow_duplicate_check: boolean
    is_special_event: boolean
    recurrence_type: RecurrenceType
    recurrence_days: WeekdayCode[]
    is_active: boolean
  } | null
}

type TodayOccurrenceResponse = {
  date?: string
  weekday?: WeekdayCode
  items?: TodayOccurrenceItem[]
  error?: string
}

const SEOUL_TIME_ZONE = 'Asia/Seoul'
const WEEKDAY_CODES: WeekdayCode[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function getKstTodayDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
function getKstDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
function getKstWeekdayCode(date = new Date()): WeekdayCode {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: SEOUL_TIME_ZONE,
    weekday: 'short',
  }).format(date)

  const map: Record<string, WeekdayCode> = {
    Mon: 'mon',
    Tue: 'tue',
    Wed: 'wed',
    Thu: 'thu',
    Fri: 'fri',
    Sat: 'sat',
    Sun: 'sun',
  }

  return map[weekday] ?? 'mon'
}

function normalizeRecurrenceDays(input: unknown): WeekdayCode[] {
  if (!Array.isArray(input)) return []

  const unique = Array.from(
    new Set(input.map((value) => String(value).trim().toLowerCase()))
  )

  return WEEKDAY_CODES.filter((day) => unique.includes(day))
}

export async function GET(_request: NextRequest): Promise<Response> {
  try {
    const authResult = await requireRole(['admin'])

    if (!authResult.ok) {
      return jsonNoStore<TodayOccurrenceResponse>(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const todayKstDate = getKstTodayDateString()
    const todayWeekday = getKstWeekdayCode()

    const { data, error } = await supabaseAdmin
      .from('event_occurrences')
      .select(`
        id,
        event_id,
        occurrence_date,
        start_time,
        end_time,
        status,
        created_at,
        updated_at,
        events (
          id,
          name,
          start_time,
          late_threshold_min,
          allow_duplicate_check,
          is_special_event,
          recurrence_type,
          recurrence_days,
          is_active
        )
      `)
      .eq('occurrence_date', todayKstDate)
      .neq('status', 'archived')
      .order('start_time', { ascending: true })

    if (error) {
      console.error('[event-occurrences/ensure-today/today] query error:', error)

      return jsonNoStore<TodayOccurrenceResponse>(
        { error: '오늘 회차 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    const items: TodayOccurrenceItem[] = Array.isArray(data)
      ? data
          .map((row: any): TodayOccurrenceItem | null => {
            const event = Array.isArray(row.events)
              ? row.events[0] ?? null
              : row.events ?? null

            if (!event) return null

            const recurrenceType = (event.recurrence_type ?? 'none') as RecurrenceType
            const recurrenceDays = normalizeRecurrenceDays(event.recurrence_days)
            const isActive = Boolean(event.is_active)

            // 이벤트가 비활성화되었으면 제외
            if (!isActive) return null

            // 반복 이벤트는 오늘 요일에 해당할 때만 표시
            if (recurrenceType === 'daily' && !recurrenceDays.includes(todayWeekday)) {
              return null
            }

            // 반복 없는 단발 이벤트는 이벤트 시작일이 오늘일 때만 표시
            if (
              recurrenceType === 'none' &&
              getKstDateString(new Date(event.start_time)) !== todayKstDate
            ) {
              return null
            }

            // daily / none 외 값은 제외
            if (recurrenceType !== 'daily' && recurrenceType !== 'none') {
              return null
            }

            return {
              id: row.id,
              event_id: row.event_id,
              occurrence_date: row.occurrence_date,
              start_time: row.start_time,
              end_time: row.end_time,
              status: row.status as OccurrenceStatus,
              created_at: row.created_at,
              updated_at: row.updated_at,
              events: {
                id: event.id,
                name: event.name,
                start_time: event.start_time,
                late_threshold_min: event.late_threshold_min,
                allow_duplicate_check: Boolean(event.allow_duplicate_check),
                is_special_event: Boolean(event.is_special_event),
                recurrence_type: recurrenceType,
                recurrence_days: recurrenceDays,
                is_active: isActive,
              },
            }
          })
          .filter((item): item is TodayOccurrenceItem => item !== null)
      : []

    return jsonNoStore<TodayOccurrenceResponse>({
      date: todayKstDate,
      weekday: todayWeekday,
      items,
    })
  } catch (error) {
    console.error('[event-occurrences/ensure-today/today] unexpected error:', error)

    return jsonNoStore<TodayOccurrenceResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
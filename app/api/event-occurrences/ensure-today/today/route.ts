// app/api/event-occurrences/ensure-today/today/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonNoStore } from '@/lib/security/api-response'

type WeekdayCode = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
type RecurrenceType = 'none' | 'daily'

type TodayOccurrenceResponse = {
  date?: string
  items?: {
    id: string
    event_id: string
    occurrence_date: string
    start_time: string
    end_time: string | null
    status: 'scheduled' | 'open' | 'closed' | 'archived'
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
  }[]
  error?: string
}

function getKstTodayDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function normalizeRecurrenceDays(input: unknown): WeekdayCode[] {
  const allowed: WeekdayCode[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

  if (!Array.isArray(input)) return []

  const unique = Array.from(
    new Set(
      input
        .map((value) => String(value).trim().toLowerCase())
        .filter((value): value is WeekdayCode =>
          allowed.includes(value as WeekdayCode)
        )
    )
  )

  return allowed.filter((day) => unique.includes(day))
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
      .order('start_time', { ascending: true })

    if (error) {
      console.error('[event-occurrences/ensure-today/today] query error:', error)

      return jsonNoStore<TodayOccurrenceResponse>(
        { error: '오늘 회차 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    const items =
      Array.isArray(data)
        ? data.map((row: any) => {
            const event = Array.isArray(row.events)
              ? row.events[0] ?? null
              : row.events ?? null

            return {
              id: row.id,
              event_id: row.event_id,
              occurrence_date: row.occurrence_date,
              start_time: row.start_time,
              end_time: row.end_time,
              status: row.status,
              created_at: row.created_at,
              updated_at: row.updated_at,
              events: event
                ? {
                    id: event.id,
                    name: event.name,
                    start_time: event.start_time,
                    late_threshold_min: event.late_threshold_min,
                    allow_duplicate_check: Boolean(event.allow_duplicate_check),
                    is_special_event: Boolean(event.is_special_event),
                    recurrence_type: (event.recurrence_type ?? 'none') as RecurrenceType,
                    recurrence_days: normalizeRecurrenceDays(event.recurrence_days),
                    is_active: Boolean(event.is_active),
                  }
                : null,
            }
          })
        : []

    return jsonNoStore<TodayOccurrenceResponse>({
      date: todayKstDate,
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
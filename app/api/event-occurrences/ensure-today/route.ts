// app/api/event-occurrences/ensure-today/route.ts
// DB정리하는 역할
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

const SEOUL_TIME_ZONE = 'Asia/Seoul'

type WeekdayCode = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

type DailyEventRow = {
  id: string
  name: string
  start_time: string
  recurrence_type: 'none' | 'daily'
  recurrence_days: WeekdayCode[] | null
  is_active: boolean
}

type TodayOccurrenceRow = {
  id: string
  event_id: string
  status: 'scheduled' | 'open' | 'closed' | 'archived'
}

function getSeoulDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

function getTodayInSeoul(): string {
  const { year, month, day } = getSeoulDateParts(new Date())
  return `${year}-${month}-${day}`
}

function getTodayWeekdayInSeoul(): WeekdayCode {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: SEOUL_TIME_ZONE,
    weekday: 'short',
  }).format(new Date())

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

function buildOccurrenceStart(baseIso: string, targetDate: string): string {
  const base = new Date(baseIso)

  if (Number.isNaN(base.getTime())) {
    throw new Error('INVALID_EVENT_START_TIME')
  }

  const { hour, minute, second } = getSeoulDateParts(base)
  const seoulLocalIso = `${targetDate}T${hour}:${minute}:${second}+09:00`
  const localDate = new Date(seoulLocalIso)

  if (Number.isNaN(localDate.getTime())) {
    throw new Error('INVALID_OCCURRENCE_START_TIME')
  }

  return localDate.toISOString()
}

function normalizeRecurrenceDays(days: unknown): WeekdayCode[] {
  const validDays: WeekdayCode[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

  if (!Array.isArray(days)) return []

  const unique = Array.from(new Set(days.map((day) => String(day).trim())))

  return validDays.filter((day) => unique.includes(day))
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])

    if (!authResult.ok) {
      return jsonNoStore(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const today = getTodayInSeoul()
    const todayWeekday = getTodayWeekdayInSeoul()

    const { data: events, error: eventsError } = await supabaseAdmin
      .from('events')
      .select(`
        id,
        name,
        start_time,
        recurrence_type,
        recurrence_days,
        is_active
      `)
      .eq('is_active', true)
      .eq('recurrence_type', 'daily')

    if (eventsError) {
      return jsonNoStore(
        { error: eventsError.message },
        { status: 500 }
      )
    }

    const targetEvents = ((events ?? []) as DailyEventRow[]).filter((event) => {
      const recurrenceDays = normalizeRecurrenceDays(event.recurrence_days)
      return recurrenceDays.includes(todayWeekday)
    })

    const targetEventIdSet = new Set(targetEvents.map((event) => event.id))

    // 오늘 요일에서 제외된 기존 회차 정리
    const { data: todayOccurrences, error: cleanupQueryError } = await supabaseAdmin
      .from('event_occurrences')
      .select('id, event_id, status')
      .eq('occurrence_date', today)
      .neq('status', 'archived')

    if (cleanupQueryError) {
      return jsonNoStore(
        { error: '오늘 회차 정리 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    const staleOccurrenceIds = ((todayOccurrences ?? []) as TodayOccurrenceRow[])
      .filter((occurrence) => !targetEventIdSet.has(occurrence.event_id))
      .filter((occurrence) => occurrence.status !== 'closed')
      .map((occurrence) => occurrence.id)

    if (staleOccurrenceIds.length > 0) {
      const { error: archiveError } = await supabaseAdmin
        .from('event_occurrences')
        .update({ status: 'archived' })
        .in('id', staleOccurrenceIds)

      if (archiveError) {
        return jsonNoStore(
          { error: '요일에서 제외된 오늘 회차 정리에 실패했습니다.' },
          { status: 500 }
        )
      }
    }

    const created: string[] = []
    const skipped: string[] = []
    const failed: Array<{ event_id: string; reason: string }> = []

    for (const event of targetEvents) {
      try {
        const startTime = buildOccurrenceStart(event.start_time, today)

        const { data: existingOccurrence, error: existingError } = await supabaseAdmin
          .from('event_occurrences')
          .select('id, status')
          .eq('event_id', event.id)
          .eq('occurrence_date', today)
          .maybeSingle()

        if (existingError) {
          failed.push({
            event_id: event.id,
            reason: existingError.message,
          })
          continue
        }

        if (existingOccurrence) {
          if (existingOccurrence.status === 'archived') {
            const { error: reopenError } = await supabaseAdmin
              .from('event_occurrences')
              .update({
                start_time: startTime,
                status: 'open',
              })
              .eq('id', existingOccurrence.id)

            if (reopenError) {
              failed.push({
                event_id: event.id,
                reason: reopenError.message,
              })
              continue
            }

            created.push(event.id)
            continue
          }

          skipped.push(event.id)
          continue
        }

        const { error: insertError } = await supabaseAdmin
          .from('event_occurrences')
          .insert({
            event_id: event.id,
            occurrence_date: today,
            start_time: startTime,
            status: 'open',
          })

        if (insertError) {
          failed.push({
            event_id: event.id,
            reason: insertError.message,
          })
          continue
        }

        created.push(event.id)
      } catch (error) {
        failed.push({
          event_id: event.id,
          reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        })
      }
    }

    return jsonNoStore(
      {
        message: '오늘 회차 동기화가 완료되었습니다.',
        date: today,
        weekday: todayWeekday,
        created_count: created.length,
        created_event_ids: created,
        skipped_count: skipped.length,
        skipped_event_ids: skipped,
        archived_count: staleOccurrenceIds.length,
        archived_occurrence_ids: staleOccurrenceIds,
        failed_count: failed.length,
        failed,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('[event-occurrences/ensure-today] unexpected error:', error)
    }

    return jsonNoStore(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
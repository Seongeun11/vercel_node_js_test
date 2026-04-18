// app/api/event-occurrences/ensure-today/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

const SEOUL_TIME_ZONE = 'Asia/Seoul'

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

function buildOccurrenceStart(baseIso: string, targetDate: string): string {
  // baseIso에 저장된 "시:분:초"를 유지하되, targetDate 날짜로 회차 생성
  // 운영 기준을 Asia/Seoul로 고정
  const base = new Date(baseIso)
  if (Number.isNaN(base.getTime())) {
    throw new Error('INVALID_EVENT_START_TIME')
  }

  const { hour, minute, second } = getSeoulDateParts(base)

  // 서울 기준 targetDate HH:mm:ss 를 UTC ISO로 변환
  const seoulLocalIso = `${targetDate}T${hour}:${minute}:${second}+09:00`
  const localDate = new Date(seoulLocalIso)

  if (Number.isNaN(localDate.getTime())) {
    throw new Error('INVALID_OCCURRENCE_START_TIME')
  }

  return localDate.toISOString()
}

type DailyEventRow = {
  id: string
  name: string
  start_time: string
  recurrence_type: 'none' | 'daily'
  is_active: boolean
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

    const { data: events, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('id, name, start_time, recurrence_type, is_active')
      .eq('is_active', true)
      .eq('recurrence_type', 'daily')

    if (eventsError) {
      return jsonNoStore(
        { error: eventsError.message },
        { status: 500 }
      )
    }

    const created: string[] = []
    const skipped: string[] = []
    const failed: Array<{ event_id: string; reason: string }> = []

    for (const event of (events ?? []) as DailyEventRow[]) {
      try {
        const startTime = buildOccurrenceStart(event.start_time, today)

        // unique(event_id, occurrence_date)를 전제로 upsert 사용
        const { data: upserted, error: upsertError } = await supabaseAdmin
          .from('event_occurrences')
          .upsert(
            {
              event_id: event.id,
              occurrence_date: today,
              start_time: startTime,
              status: 'open',
            },
            {
              onConflict: 'event_id,occurrence_date',
              ignoreDuplicates: false,
            }
          )
          .select('id, event_id')
          .single()

        if (upsertError) {
          failed.push({
            event_id: event.id,
            reason: upsertError.message,
          })
          continue
        }

        // 이미 있었는지 여부를 정확히 구분하려면 한 번 더 확인하는 방식도 가능하지만,
        // 지금은 "존재하지 않으면 생성, 있으면 유지"가 목적이라 성공 처리
        if (upserted?.event_id) {
          created.push(event.id)
        } else {
          skipped.push(event.id)
        }
      } catch (error) {
        failed.push({
          event_id: event.id,
          reason:
            error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        })
      }
    }

    return jsonNoStore(
      {
        message: '오늘 회차 생성 완료',
        date: today,
        created_count: created.length,
        created_event_ids: created,
        skipped_count: skipped.length,
        skipped_event_ids: skipped,
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
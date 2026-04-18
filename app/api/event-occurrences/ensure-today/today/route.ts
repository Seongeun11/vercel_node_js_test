// app/api/event-occurrences/ensure-today/today/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { jsonNoStore } from '@/lib/security/api-response'

const SEOUL_TIME_ZONE = 'Asia/Seoul'

function getTodayInSeoul(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(new Date())
}

export async function GET(_request: NextRequest): Promise<Response> {
  const authResult = await requireRole(['admin'])
  if (!authResult.ok) {
    return jsonNoStore(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  const today = getTodayInSeoul()

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
        is_active
      )
    `)
    .eq('occurrence_date', today)
    .order('start_time', { ascending: true })

  if (error) {
    return jsonNoStore(
      { error: error.message },
      { status: 500 }
    )
  }

  return jsonNoStore(
    {
      items: data ?? [],
      date: today,
      count: (data ?? []).length,
    },
    { status: 200 }
  )
}
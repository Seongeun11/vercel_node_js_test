// app/api/events/create/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type CreateEventBody = {
  name?: string
  start_time?: string
  late_threshold_min?: number
  allow_duplicate_check?: boolean
  is_special_event?: boolean
}

type CreateEventResponse = {
  message?: string
  event?: {
    id: string
    name: string
    start_time: string
    late_threshold_min: number
    allow_duplicate_check: boolean
    created_at: string
  }
  error?: string
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
    const isSpecialEvent = Boolean(body.is_special_event)
    const name = String(body.name ?? '').trim()
    const startTimeRaw = String(body.start_time ?? '').trim()
    const lateThresholdMin = Number(body.late_threshold_min ?? 5)
    const allowDuplicateCheck = Boolean(body.allow_duplicate_check)

    if (!name) {
      return jsonNoStore<CreateEventResponse>(
        { error: '이벤트명을 입력해주세요.' },
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

    const { data: createdEvent, error } = await supabaseAdmin
      .from('events')
      .insert({
        name,
        start_time: startTime.toISOString(),
        late_threshold_min: lateThresholdMin,
        allow_duplicate_check: allowDuplicateCheck,
        is_special_event: isSpecialEvent,
      })
      .select(
        'id, name, start_time, late_threshold_min, allow_duplicate_check, is_special_event, created_at'
      )
      .single()

    if (error || !createdEvent) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[events/create] insert error:', error)
      }

      return jsonNoStore<CreateEventResponse>(
        { error: error?.message || '이벤트 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    return jsonNoStore<CreateEventResponse>(
      {
        message: '이벤트가 생성되었습니다.',
        event: createdEvent,
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
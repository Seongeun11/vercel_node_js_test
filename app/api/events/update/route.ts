// app/api/events/update/route.ts
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'


type UpdateEventBody = {
  id?: string
  name?: string
  start_time?: string
  late_threshold_min?: number
  allow_duplicate_check?: boolean
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])
    
    if (!authResult.ok) {
      return jsonNoStore(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as UpdateEventBody

    const id = String(body.id || '').trim()
    const name = String(body.name || '').trim()
    const startTimeRaw = String(body.start_time || '').trim()
    const lateThresholdMin = Number(body.late_threshold_min ?? 5)
    const allowDuplicateCheck = Boolean(body.allow_duplicate_check)

    if (!id) {
      return jsonNoStore(
        { error: '이벤트 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!name) {
      return jsonNoStore(
        { error: '이벤트명을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!startTimeRaw) {
      return jsonNoStore(
        { error: '시작 시간을 입력해주세요.' },
        { status: 400 }
      )
    }

    const startTime = new Date(startTimeRaw)

    if (Number.isNaN(startTime.getTime())) {
      return jsonNoStore(
        { error: '시작 시간 형식이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    if (!Number.isFinite(lateThresholdMin) || lateThresholdMin < 0 || lateThresholdMin > 180) {
      return jsonNoStore(
        { error: '지각 기준은 0~180분 사이여야 합니다.' },
        { status: 400 }
      )
    }

    const { data: existingEvent, error: existingError } = await supabaseAdmin
      .from('events')
      .select('id, name, start_time, late_threshold_min, allow_duplicate_check, created_at')
      .eq('id', id)
      .single()

    if (existingError || !existingEvent) {
      return jsonNoStore(
        { error: '수정할 이벤트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const nextStartTimeIso = startTime.toISOString()

    const updatePayload: Partial<{
      name: string
      start_time: string
      late_threshold_min: number
      allow_duplicate_check: boolean
    }> = {}

    if (existingEvent.name !== name) {
      updatePayload.name = name
    }

    if (existingEvent.start_time !== nextStartTimeIso) {
      updatePayload.start_time = nextStartTimeIso
    }

    if (Number(existingEvent.late_threshold_min) !== lateThresholdMin) {
      updatePayload.late_threshold_min = lateThresholdMin
    }

    if (Boolean(existingEvent.allow_duplicate_check) !== allowDuplicateCheck) {
      updatePayload.allow_duplicate_check = allowDuplicateCheck
    }

    if (Object.keys(updatePayload).length === 0) {
      return jsonNoStore(
        { error: '변경된 내용이 없습니다.' },
        { status: 400 }
      )
    }

    const { data: updatedEvent, error: updateError } = await supabaseAdmin
      .from('events')
      .update(updatePayload)
      .eq('id', id)
      .select('id, name, start_time, late_threshold_min, allow_duplicate_check, created_at')
      .single()

    if (updateError || !updatedEvent) {
      return jsonNoStore(
        { error: updateError?.message || '이벤트 수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    return jsonNoStore(
      {
        message: '이벤트가 수정되었습니다.',
        event: updatedEvent,
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
  }
}
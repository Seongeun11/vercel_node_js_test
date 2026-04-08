// app/api/events/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type CreateEventBody = {
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

    const body = (await request.json()) as CreateEventBody

    const name = String(body.name || '').trim()
    const startTimeRaw = String(body.start_time || '').trim()
    const lateThresholdMin = Number(body.late_threshold_min ?? 5)
    const allowDuplicateCheck = Boolean(body.allow_duplicate_check)

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

    const { data: createdEvent, error } = await supabaseAdmin
      .from('events')
      .insert({
        name,
        start_time: startTime.toISOString(),
        late_threshold_min: lateThresholdMin,
        allow_duplicate_check: allowDuplicateCheck,
      })
      .select('id, name, start_time, late_threshold_min, allow_duplicate_check, created_at')
      .single()

    if (error || !createdEvent) {
      return jsonNoStore(
        { error: error?.message || '이벤트 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    return jsonNoStore(
      {
        message: '이벤트가 생성되었습니다.',
        event: createdEvent,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('events/create POST error:', error)
    return jsonNoStore(
      { error: '이벤트 생성 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
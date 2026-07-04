// app/api/events/update/route.ts
import { NextRequest } from 'next/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type RecurrenceType = 'none' | 'daily'
type WeekdayCode = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

type UpdateEventBody = {
  id?: string
  name?: string
  start_time?: string
  late_threshold_min?: number
  allow_duplicate_check?: boolean
  is_special_event?: boolean
  recurrence_type?: RecurrenceType
  recurrence_days?: WeekdayCode[]
  is_active?: boolean
  affiliations_id?: string | number | null
}

type UpdateEventResponse = {
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
    affiliations_id: number | null
  }
  error?: string
}

const WEEKDAY_CODES: WeekdayCode[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function normalizeRecurrenceDays(value: unknown): WeekdayCode[] {
  if (!Array.isArray(value)) return []
  const unique = Array.from(new Set(value.map((item) => String(item).trim())))
  return WEEKDAY_CODES.filter((day) => unique.includes(day))
}

function hasInvalidRecurrenceDay(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.some((item) => !WEEKDAY_CODES.includes(String(item).trim() as WeekdayCode))
}

function sameDays(a: WeekdayCode[], b: WeekdayCode[]): boolean {
  if (a.length !== b.length) return false
  return a.every((day, index) => day === b[index])
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])
    if (!authResult.ok) {
      return jsonNoStore<UpdateEventResponse>(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as UpdateEventBody

    const id = String(body.id ?? '').trim()
    const name = String(body.name ?? '').trim()
    const startTimeRaw = String(body.start_time ?? '').trim()
    const lateThresholdMin = Number(body.late_threshold_min ?? 5)
    const allowDuplicateCheck = Boolean(body.allow_duplicate_check)
    const isSpecialEvent = Boolean(body.is_special_event)
    const recurrenceType = String(body.recurrence_type ?? 'none').trim() as RecurrenceType
    const recurrenceDays =
      recurrenceType === 'daily' ? normalizeRecurrenceDays(body.recurrence_days) : []
    const isActive = body.is_active ?? true

    let parsedAffiliationsId: number | null = null
    if (body.affiliations_id !== undefined && body.affiliations_id !== null && String(body.affiliations_id).trim() !== '') {
      parsedAffiliationsId = Number(body.affiliations_id)
      if (Number.isNaN(parsedAffiliationsId)) {
        parsedAffiliationsId = null
      }
    }

    if (!id) return jsonNoStore<UpdateEventResponse>({ error: '행사 ID가 필요합니다.' }, { status: 400 })
    if (!name) return jsonNoStore<UpdateEventResponse>({ error: '행사명을 입력해주세요.' }, { status: 400 })
    if (!startTimeRaw) return jsonNoStore<UpdateEventResponse>({ error: '시작 시간을 입력해주세요.' }, { status: 400 })

    const startTime = new Date(startTimeRaw)
    if (Number.isNaN(startTime.getTime())) {
      return jsonNoStore<UpdateEventResponse>({ error: '시작 시간 형식이 올바르지 않습니다.' }, { status: 400 })
    }

    if (!Number.isFinite(lateThresholdMin) || lateThresholdMin < 0 || lateThresholdMin > 180) {
      return jsonNoStore<UpdateEventResponse>({ error: '지각 기준은 0~180분 사이여야 합니다.' }, { status: 400 })
    }

    if (!['none', 'daily'].includes(recurrenceType)) {
      return jsonNoStore<UpdateEventResponse>({ error: '반복 규칙은 none 또는 daily만 가능합니다.' }, { status: 400 })
    }

    if (hasInvalidRecurrenceDay(body.recurrence_days)) {
      return jsonNoStore<UpdateEventResponse>({ error: '반복 요일 값이 올바르지 않습니다.' }, { status: 400 })
    }

    if (recurrenceType === 'daily' && recurrenceDays.length === 0) {
      return jsonNoStore<UpdateEventResponse>({ error: '반복 요일을 1개 이상 선택해주세요.' }, { status: 400 })
    }

    // 1. 기존 데이터 조회
    const { data: existingEvent, error: existingError } = await supabaseAdmin
      .from('events')
      .select(`
        id, name, start_time, late_threshold_min, allow_duplicate_check,
        is_special_event, recurrence_type, recurrence_days, is_active, created_at, affiliations_id
      `)
      .eq('id', id)
      .single()

    if (existingError || !existingEvent) {
      return jsonNoStore<UpdateEventResponse>({ error: '수정할 행사를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 부모 데이터의 기본 타임스탬프 베이스 확보
    const existingParentDate = new Date(existingEvent.start_time)
    existingParentDate.setUTCHours(startTime.getUTCHours(), startTime.getUTCMinutes(), 0, 0)
    const nextParentStartTimeIso = existingParentDate.toISOString()

    // 2. 변경 사항 감지 및 Payload 조립
    const updatePayload: Partial<{
      name: string
      start_time: string
      late_threshold_min: number
      allow_duplicate_check: boolean
      is_special_event: boolean
      recurrence_type: RecurrenceType
      recurrence_days: WeekdayCode[]
      is_active: boolean
      affiliations_id: number | null
    }> = {}

    const existingDays = normalizeRecurrenceDays(existingEvent.recurrence_days)

    if (existingEvent.name !== name) updatePayload.name = name
    if (existingEvent.start_time !== nextParentStartTimeIso) updatePayload.start_time = nextParentStartTimeIso
    if (Number(existingEvent.late_threshold_min) !== lateThresholdMin) updatePayload.late_threshold_min = lateThresholdMin
    if (Boolean(existingEvent.allow_duplicate_check) !== allowDuplicateCheck) updatePayload.allow_duplicate_check = allowDuplicateCheck
    if (Boolean(existingEvent.is_special_event) !== isSpecialEvent) updatePayload.is_special_event = isSpecialEvent
    if (String(existingEvent.recurrence_type ?? 'none') !== recurrenceType) updatePayload.recurrence_type = recurrenceType
    if (!sameDays(existingDays, recurrenceDays)) updatePayload.recurrence_days = recurrenceDays
    if (Boolean(existingEvent.is_active) !== Boolean(isActive)) updatePayload.is_active = Boolean(isActive)
    if (existingEvent.affiliations_id !== parsedAffiliationsId) updatePayload.affiliations_id = parsedAffiliationsId

    if (Object.keys(updatePayload).length === 0) {
      return jsonNoStore<UpdateEventResponse>({ error: '변경된 내용이 없습니다.' }, { status: 400 })
    }

    // 3. 마스터 행사의 테이블(events) 업데이트 진행
    const { data: updatedEvent, error: updateError } = await supabaseAdmin
      .from('events')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        id, name, start_time, late_threshold_min, allow_duplicate_check,
        is_special_event, recurrence_type, recurrence_days, is_active, created_at, affiliations_id
      `)
      .single()
        
    if (updateError || !updatedEvent) {
      return jsonNoStore<UpdateEventResponse>(
        { error: updateError?.message || '행사 수정에 실패했습니다.' },
        { status: 500 }
      )
    } 

    // 4. [논리 교정완료] 부모 시간이 바뀌었다면, 오늘(KST) 열려 있는 자식 회차 시간 동기화 처리
    if (updatePayload.start_time) {
      // ◀ 수정한 핵심 포인트: 기존 시작일 기준이 아닌, "요청 처리 시점의 현재 한국 날짜"를 강제 추출합니다.
      const targetOccurrenceDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()) 

      // 자식 테이블 주입용 타임스탬프도 "오늘 날짜 + 유저가 입력한 시/분" 조합으로 오차 없이 조립
      const childTargetDate = new Date()
      childTargetDate.setUTCHours(startTime.getUTCHours(), startTime.getUTCMinutes(), 0, 0)
      const targetStartTimeIso = childTargetDate.toISOString()

      const { error: childUpdateError } = await supabaseAdmin
        .from('event_occurrences')
        .update({ start_time: targetStartTimeIso }) 
        .eq('event_id', id)
        .eq('occurrence_date', targetOccurrenceDateStr) // 정확하게 오늘 날짜 문자열 매핑 완료 ("2026-06-07")
        .in('status', ['scheduled', 'open'])

      if (childUpdateError) {
        console.error('자식 회차 동기화 실패:', childUpdateError)
      }
    }

    // 5. 오늘 회차 자동 생성 RPC 호출
    const { error: rpcError } = await supabaseAdmin.rpc('cron_create_today_occurrences')
    if (rpcError) {
      console.error('[events/update] rpc sync error:', rpcError)
      return jsonNoStore<UpdateEventResponse>(
        { error: '행사는 수정되었으나 출석판 자동 동기화에 실패했습니다. 관리자 화면에서 동기화를 눌러주세요.' },
        { status: 500 }
      )
    }

    return jsonNoStore<UpdateEventResponse>(
      {
        message: '행사가 수정되었습니다.',
        event: updatedEvent as UpdateEventResponse['event'],
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<UpdateEventResponse>({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
    }
    if (process.env.NODE_ENV !== 'production') {
      console.error('[events/update] unexpected error:', error)
    }
    return jsonNoStore<UpdateEventResponse>({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
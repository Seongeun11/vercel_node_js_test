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
  affiliations_id?: string | number | null // [수정] 소속 아이디 입력 타입 정의 추가
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
    affiliations_id: number | null // [수정] 소속 아이디 출력 규격 추가
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

    // [수정] affiliations_id 데이터 정제 및 타입 변환 처리 (공백이나 유효하지 않은 타입 유입 시 null 바인딩)
    let parsedAffiliationsId: number | null = null
    if (body.affiliations_id !== undefined && body.affiliations_id !== null && String(body.affiliations_id).trim() !== '') {
      parsedAffiliationsId = Number(body.affiliations_id)
      if (Number.isNaN(parsedAffiliationsId)) {
        parsedAffiliationsId = null
      }
    }

    if (!id) {
      return jsonNoStore<UpdateEventResponse>(
        { error: '행사 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!name) {
      return jsonNoStore<UpdateEventResponse>(
        { error: '행사명을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!startTimeRaw) {
      return jsonNoStore<UpdateEventResponse>(
        { error: '시작 시간을 입력해주세요.' },
        { status: 400 }
      )
    }

    const startTime = new Date(startTimeRaw)

    if (Number.isNaN(startTime.getTime())) {
      return jsonNoStore<UpdateEventResponse>(
        { error: '시작 시간 형식이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    if (
      !Number.isFinite(lateThresholdMin) ||
      lateThresholdMin < 0 ||
      lateThresholdMin > 180
    ) {
      return jsonNoStore<UpdateEventResponse>(
        { error: '지각 기준은 0~180분 사이여야 합니다.' },
        { status: 400 }
      )
    }

    if (!['none', 'daily'].includes(recurrenceType)) {
      return jsonNoStore<UpdateEventResponse>(
        { error: '반복 규칙은 none 또는 daily만 가능합니다.' },
        { status: 400 }
      )
    }

    if (hasInvalidRecurrenceDay(body.recurrence_days)) {
      return jsonNoStore<UpdateEventResponse>(
        { error: '반복 요일 값이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    if (recurrenceType === 'daily' && recurrenceDays.length === 0) {
      return jsonNoStore<UpdateEventResponse>(
        { error: '반복 요일을 1개 이상 선택해주세요.' },
        { status: 400 }
      )
    }

    // [수정] select 절에 affiliations_id 컬럼 추가 기입
    const { data: existingEvent, error: existingError } = await supabaseAdmin
      .from('events')
      .select(`
        id,
        name,
        start_time,
        late_threshold_min,
        allow_duplicate_check,
        is_special_event,
        recurrence_type,
        recurrence_days,
        is_active,
        created_at,
        affiliations_id
      `)
      .eq('id', id)
      .single()

    if (existingError || !existingEvent) {
      return jsonNoStore<UpdateEventResponse>(
        { error: '수정할 행사를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const nextStartTimeIso = startTime.toISOString()

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
    if (existingEvent.start_time !== nextStartTimeIso) updatePayload.start_time = nextStartTimeIso
    if (Number(existingEvent.late_threshold_min) !== lateThresholdMin) {
      updatePayload.late_threshold_min = lateThresholdMin
    }
    if (Boolean(existingEvent.allow_duplicate_check) !== allowDuplicateCheck) {
      updatePayload.allow_duplicate_check = allowDuplicateCheck
    }
    if (Boolean(existingEvent.is_special_event) !== isSpecialEvent) {
      updatePayload.is_special_event = isSpecialEvent
    }
    if (String(existingEvent.recurrence_type ?? 'none') !== recurrenceType) {
      updatePayload.recurrence_type = recurrenceType
    }
    if (!sameDays(existingDays, recurrenceDays)) {
      updatePayload.recurrence_days = recurrenceDays
    }
    if (Boolean(existingEvent.is_active) !== Boolean(isActive)) {
      updatePayload.is_active = Boolean(isActive)
    }
    // [수정] 변환 완료된 소속 식별값의 변경 감지 매핑 파트 추가
    if (existingEvent.affiliations_id !== parsedAffiliationsId) {
      updatePayload.affiliations_id = parsedAffiliationsId
    }

    if (Object.keys(updatePayload).length === 0) {
      return jsonNoStore<UpdateEventResponse>(
        { error: '변경된 내용이 없습니다.' },
        { status: 400 }
      )
    }
    
    // [수정] 최종 반환 데이터 select 구문에도 affiliations_id 포함 처리 명시화
    const { data: updatedEvent, error: updateError } = await supabaseAdmin
      .from('events')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        id,
        name,
        start_time,
        late_threshold_min,
        allow_duplicate_check,
        is_special_event,
        recurrence_type,
        recurrence_days,
        is_active,
        created_at,
        affiliations_id
      `)
      .single()
        
    if (updateError || !updatedEvent) {
      return jsonNoStore<UpdateEventResponse>(
        { error: updateError?.message || '행사 수정에 실패했습니다.' },
        { status: 500 }
      )
    } 

    // 2. 기존 부모 데이터의 날짜에 유저가 보낸 "시/분"만 이식한 새로운 부모용 ISO 타임 생성
    const existingParentDate = new Date(existingEvent.start_time)
    existingParentDate.setUTCHours(startTime.getUTCHours(), startTime.getUTCMinutes(), 0, 0)
    const nextParentStartTimeIso = existingParentDate.toISOString()

    // 3. 부모 테이블 변경 감지 및 페이로드 세팅
    if (existingEvent.start_time !== nextParentStartTimeIso) {
      updatePayload.start_time = nextParentStartTimeIso
    }

    // 4. [완벽 교정] 부모 시간이 바뀌었다면, 오늘 열려 있는 자식 회차 시간도 동기화
    if (updatePayload.start_time) {
      
      // [교정 1] 서버의 Date()를 쓰면 시차가 깨지므로, 기존 부모 이벤트(existingEvent.start_time)의 
      // 실제 한국 기준 날짜 문자열("YYYY-MM-DD")을 직접 안전하게 추출합니다.
      const targetOccurrenceDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(existingEvent.start_time)) // 기존 마스터 시간에 박혀있던 정직한 날짜 사용

      // [교정 2] 자식 테이블에 주입할 start_time ISO도 기존 마스터 날짜 기반에 유저가 보낸 시/분만 정밀 이식합니다.
      const childTargetDate = new Date(existingEvent.start_time)
      childTargetDate.setUTCHours(startTime.getUTCHours(), startTime.getUTCMinutes(), 0, 0)
      const targetStartTimeIso = childTargetDate.toISOString()

      // Supabase 갱신 실행 (이제 날짜 문자열이 정확히 2026-06-07로 매치됩니다)
      const { error: updateError } = await supabaseAdmin
        .from('event_occurrences')
        .update({ 
          start_time: targetStartTimeIso 
        })
        .eq('event_id', id)
        .eq('occurrence_date', targetOccurrenceDateStr) // ◀ 이제 정확히 "2026-06-07"이 매핑되어 조건 일치
        .in('status', ['scheduled', 'open'])

      if (updateError) {
        console.error('자식 회차 동기화 실패:', updateError)
      }

      //console.log('타겟팅된 회차 날짜 문자열(KST): ', targetOccurrenceDateStr) // 출력: 2026-06-07
      //console.log('변경될 자식 시작시간 ISO: ', targetStartTimeIso)
    }

    const { error: rpcError } = await supabaseAdmin.rpc('fn_create_today_occurrences')
        
            if (rpcError) {
              console.error('[events/create] rpc sync error:', rpcError)
              // 사용자 경험을 위해 행사는 만들어졌으므로 에러로 튕구기보단 경고 메시지 형태를 권장하나, 
              // 완벽한 트랜잭션을 원한다면 아래처럼 500 에러를 반환할 수 있습니다.
              return jsonNoStore<UpdateEventResponse>(
                { error: '행사는 생성되었으나 출석판 자동 동기화에 실패했습니다. 관리자 화면에서 동기화를 눌러주세요.' },
                { status: 500 }
              )}
    return jsonNoStore<UpdateEventResponse>(
      {
        message: '행사가 수정되었습니다.',
        event: updatedEvent as UpdateEventResponse['event'],
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<UpdateEventResponse>(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('[events/update] unexpected error:', error)
    }

    return jsonNoStore<UpdateEventResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
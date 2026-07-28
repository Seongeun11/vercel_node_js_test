//app\api\attendance\edit\route.ts

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type AttendanceStatus = 'present' | 'late' | 'absent'
type AttendanceMethod = 'manual' | 'qr' | 'nfc'

type EditAttendanceBody = {
  attendance_id?: string
  event_id?: string
  status?: AttendanceStatus
  method?: AttendanceMethod
  check_time?: string | null
  reason?: string
}

type AttendanceRow = {
  id: string
  user_id: string
  event_id: string
  occurrence_id: string
  attendance_date: string
  status: AttendanceStatus
  method: AttendanceMethod
  check_time: string
  created_at: string
  updated_at: string
}

type EditAttendanceResponse = {
  message?: string
  item?: AttendanceRow
  error?: string
}

const ALLOWED_STATUS: AttendanceStatus[] = ['present', 'late', 'absent']
const ALLOWED_METHOD: AttendanceMethod[] = ['manual', 'qr', 'nfc']

function isValidStatus(value: unknown): value is AttendanceStatus {
  return typeof value === 'string' && ALLOWED_STATUS.includes(value as AttendanceStatus)
}

function isValidMethod(value: unknown): value is AttendanceMethod {
  return typeof value === 'string' && ALLOWED_METHOD.includes(value as AttendanceMethod)
}

function normalizeReason(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseCheckTime(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])
    if (!authResult.ok || !authResult.user) {
      return jsonNoStore<EditAttendanceResponse>(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = (await request.json()) as EditAttendanceBody

    const attendanceId = typeof body.attendance_id === 'string' ? body.attendance_id.trim() : ''
    const newEventId = typeof body.event_id === 'string' ? body.event_id.trim() : ''
    const reason = normalizeReason(body.reason)

    if (!attendanceId) {
      return jsonNoStore<EditAttendanceResponse>(
        { error: 'attendance_id가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!reason) {
      return jsonNoStore<EditAttendanceResponse>(
        { error: '수정 사유(reason)는 필수입니다.' },
        { status: 400 }
      )
    }

    if (body.status !== undefined && !isValidStatus(body.status)) {
      return jsonNoStore<EditAttendanceResponse>(
        { error: 'status 값이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    if (body.method !== undefined && !isValidMethod(body.method)) {
      return jsonNoStore<EditAttendanceResponse>(
        { error: 'method 값이 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    const parsedCheckTime = parseCheckTime(body.check_time)

    if (parsedCheckTime !== undefined && parsedCheckTime !== null) {
      const checkTimeDate = new Date(parsedCheckTime)
      if (Number.isNaN(checkTimeDate.getTime())) {
        return jsonNoStore<EditAttendanceResponse>(
          { error: 'check_time 형식이 올바르지 않습니다.' },
          { status: 400 }
        )
      }
    }

    // 1. 기존 출석 원본 데이터 조회
    const { data: currentRecord, error: fetchError } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('id', attendanceId)
      .single()

    if (fetchError || !currentRecord) {
      return jsonNoStore<EditAttendanceResponse>(
        { error: '수정 대상 출석 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    let targetEventId = currentRecord.event_id
    let targetOccurrenceId = currentRecord.occurrence_id
    const attendanceDate = currentRecord.attendance_date

    // 2. 행사(event_id) 변경 요청이 존재하고, 기존 행사와 다를 경우 회차 처리
    if (newEventId && newEventId !== currentRecord.event_id) {
      targetEventId = newEventId

      // 변경하려는 행사의 당일 회차(occurrence) 조회
      const { data: occData, error: occError } = await supabaseAdmin
        .from('event_occurrences')
        .select('id')
        .eq('event_id', targetEventId)
        .eq('occurrence_date', attendanceDate)
        .maybeSingle()

      if (occError) {
        console.error('[attendance/edit] occurrence search error:', occError)
        return jsonNoStore<EditAttendanceResponse>(
          { error: '변경할 행사의 회차 정보를 조회하는 데 실패했습니다.' },
          { status: 500 }
        )
      }

      if (occData) {
        targetOccurrenceId = occData.id
      } else {
        // 회차가 없으면 자동 생성 후 occurrence_id 확보
        const startTimeString = `${attendanceDate}T09:00:00.000Z`
        const { data: newOcc, error: createOccErr } = await supabaseAdmin
          .from('event_occurrences')
          .insert({
            event_id: targetEventId,
            occurrence_date: attendanceDate,
            start_time: startTimeString,
            status: 'open'
          })
          .select('id')
          .single()

        if (createOccErr || !newOcc) {
          console.error('[attendance/edit] occurrence create error:', createOccErr)
          return jsonNoStore<EditAttendanceResponse>(
            { error: '대상 행사의 당일 회차 자동 생성에 실패했습니다.' },
            { status: 500 }
          )
        }
        targetOccurrenceId = newOcc.id
      }
    }

    // 3. 출석 레코드 업데이트 페이로드 구성
    const updatePayload: Record<string, any> = {
      event_id: targetEventId,
      occurrence_id: targetOccurrenceId,
      updated_at: new Date().toISOString()
    }

    if (body.status) {
      updatePayload.status = body.status
    }
    if (body.method) {
      updatePayload.method = body.method
    }
    if (parsedCheckTime !== undefined) {
      updatePayload.check_time = parsedCheckTime ? new Date(parsedCheckTime).toISOString() : new Date().toISOString()
    }

    // 4. DB 테이블 업데이트 진행
    const { data: updatedRecord, error: updateError } = await supabaseAdmin
      .from('attendance')
      .update(updatePayload)
      .eq('id', attendanceId)
      .select()
      .single()

    if (updateError) {
      console.error('[attendance/edit] update error:', updateError)

      // 동일 유저/회차 중복 체크 제약조건 위반 시
      if (
        updateError.code === '23505' ||
        updateError.message.includes('uq_attendance_user_occurrence')
      ) {
        return jsonNoStore<EditAttendanceResponse>(
          { error: '변경 대상 행사에 해당 유저의 출석 기록이 이미 존재합니다.' },
          { status: 409 }
        )
      }

      return jsonNoStore<EditAttendanceResponse>(
        { error: updateError.message || '출석 정보 수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 5. 변경 이력 감사 로그(attendance_logs) 적재
    const { error: logError } = await supabaseAdmin
      .from('attendance_logs')
      .insert([
        {
          attendance_id: attendanceId,
          changed_by: authResult.user.id,
          target_user_id: currentRecord.user_id,
          event_id: targetEventId,
          attendance_date: attendanceDate,
          action: 'update',
          reason: reason,
          before_value: currentRecord,
          after_value: updatedRecord
        }
      ])

    if (logError) {
      console.error('[attendance/edit] log insert error:', logError)
    }

    return jsonNoStore<EditAttendanceResponse>({
      message: '출석 및 대상 행사 정보가 성공적으로 수정되었습니다.',
      item: updatedRecord as AttendanceRow,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore<EditAttendanceResponse>(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    console.error('[attendance/edit] unexpected error:', error)
    return jsonNoStore<EditAttendanceResponse>(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
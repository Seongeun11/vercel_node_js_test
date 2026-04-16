// app/api/attendance/edit/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

type AttendanceStatus = 'present' | 'late' | 'absent'
type AttendanceMethod = 'manual' | 'qr' | 'nfc'

type EditAttendanceBody = {
  attendance_id?: string
  status?: AttendanceStatus
  method?: AttendanceMethod
  check_time?: string | null
  reason?: string
}

type AttendanceRow = {
  id: string
  user_id: string
  event_id: string
  date: string
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

const ALLOWED_STATUS: AttendanceStatus[] = ['present' , 'late' , 'absent']
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

    const authResult = await requireRole(['admin', 'captain'])
    if (!authResult.ok || !authResult.user) {
      return jsonNoStore<EditAttendanceResponse>(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = (await request.json()) as EditAttendanceBody

    const attendanceId =
      typeof body.attendance_id === 'string' ? body.attendance_id.trim() : ''
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

    const { data, error } = await supabaseAdmin.rpc('edit_attendance_with_log', {
      p_attendance_id: attendanceId,
      p_status: body.status ?? null,
      p_method: body.method ?? null,
      p_check_time: parsedCheckTime ? new Date(parsedCheckTime).toISOString() : null,
      p_reason: reason,
      p_changed_by: authResult.user.id,
    })

    if (error) {
      console.error('[attendance/edit] rpc error:', error)

      const message = error.message || '출석 수정에 실패했습니다.'

      if (
        message.includes('attendance_id가 필요합니다.') ||
        message.includes('수정 사유(reason)는 필수입니다.') ||
        message.includes('status 값이 올바르지 않습니다.') ||
        message.includes('method 값이 올바르지 않습니다.') ||
        message.includes('변경된 내용이 없습니다.')
      ) {
        return jsonNoStore<EditAttendanceResponse>(
          { error: message },
          { status: 400 }
        )
      }

      if (message.includes('출석 정보를 찾을 수 없습니다.')) {
        return jsonNoStore<EditAttendanceResponse>(
          { error: message },
          { status: 404 }
        )
      }

      return jsonNoStore<EditAttendanceResponse>(
        { error: message },
        { status: 500 }
      )
    }

    const item = Array.isArray(data) ? data[0] : data

    if (!item) {
      return jsonNoStore<EditAttendanceResponse>(
        { error: '출석 수정 결과를 찾을 수 없습니다.' },
        { status: 500 }
      )
    }

    return jsonNoStore<EditAttendanceResponse>({
      message: '출석 정보가 수정되었습니다.',
      item,
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
// app/api/attendance-change-requests/create/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/serverAuth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

const createAttendanceChangeRequestSchema = z.object({
  attendance_id: z.string().uuid(),
  requested_status: z.enum(['present', 'late', 'absent']),
  reason: z
    .string()
    .trim()
    .min(1, '사유를 입력해주세요.')
    .max(500, '사유는 500자 이하로 입력해주세요.'),
})

export async function POST(request: NextRequest) {
  try {
    // 1) CSRF 방어
    assertSameOrigin(request)
    const authResult = await requireRole(['trainee'])

    if (!authResult.ok) {
      return jsonNoStore(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()
    const parsed = createAttendanceChangeRequestSchema.safeParse(body)

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ?? '잘못된 요청입니다.'

      return jsonNoStore({ error: firstError }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase.rpc(
      'create_attendance_change_request',
      {
        p_attendance_id: parsed.data.attendance_id,
        p_requested_status: parsed.data.requested_status,
        p_reason: parsed.data.reason,
      }
    )

    if (error) {
      const message = error.message || ''

      if (message.includes('ATTENDANCE_NOT_FOUND_OR_FORBIDDEN')) {
        return jsonNoStore(
          { error: '본인 출석 기록에 대해서만 요청할 수 있습니다.' },
          { status: 403 }
        )
      }

      if (message.includes('ONLY_TRAINEE_CAN_REQUEST')) {
        return jsonNoStore(
          { error: '수련생만 출석 변경 요청을 생성할 수 있습니다.' },
          { status: 403 }
        )
      }

      if (message.includes('STATUS_IS_SAME')) {
        return jsonNoStore(
          { error: '현재 출석 상태와 동일한 상태로는 요청할 수 없습니다.' },
          { status: 400 }
        )
      }

      if (message.includes('PENDING_REQUEST_ALREADY_EXISTS')) {
        return jsonNoStore(
          { error: '이미 처리 대기 중인 변경 요청이 있습니다.' },
          { status: 409 }
        )
      }

      if (message.includes('REASON_REQUIRED')) {
        return jsonNoStore(
          { error: '변경 사유를 입력해주세요.' },
          { status: 400 }
        )
      }

      if (message.includes('REASON_TOO_LONG')) {
        return jsonNoStore(
          { error: '변경 사유는 500자 이하로 입력해주세요.' },
          { status: 400 }
        )
      }

      if (message.includes('INVALID_REQUESTED_STATUS')) {
        return jsonNoStore(
          { error: '요청 가능한 출석 상태가 아닙니다.' },
          { status: 400 }
        )
      }

      return jsonNoStore(
        { error: '출석 변경 요청 생성에 실패했습니다.' },
        { status: 400 }
      )
    }

    return jsonNoStore(
      {
        message: '출석 변경 요청이 접수되었습니다.',
        request_id: data,
      },
      { status: 201 }
    )
  } catch {
    return jsonNoStore(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
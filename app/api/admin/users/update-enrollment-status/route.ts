// app/api/admin/users/update-enrollment-status/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getClientIp } from '@/lib/request-ip'
import { checkRateLimit } from '@/lib/rate-limit'
import { writeAdminAuditLog } from '@/lib/admin-audit'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

const updateEnrollmentStatusSchema = z.object({
  user_id: z.string().uuid('사용자 ID가 올바르지 않습니다.'),
  enrollment_status: z.enum(['active', 'completed'], {
    message: "enrollment_status 는 'active', 'completed' 중 하나이어야 합니다.",
  }),
})

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)

  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])

    if (!authResult.ok || !authResult.user) {
      return jsonNoStore(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const rateLimit = await checkRateLimit(
      `admin:update-enrollment-status:ip:${clientIp}`,
      30,
      60
    )

    if (!rateLimit.ok) {
      return jsonNoStore(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.resetInSeconds),
          },
        }
      )
    }

    const rawBody = await request.json()
    const parsed = updateEnrollmentStatusSchema.safeParse(rawBody)

    if (!parsed.success) {
      const flattened = parsed.error.flatten()

      return jsonNoStore(
        {
          error: '입력값이 올바르지 않습니다.',
          field_errors: flattened.fieldErrors,
          form_errors: flattened.formErrors,
        },
        { status: 400 }
      )
    }

    const { user_id: userId, enrollment_status: enrollmentStatus } =
      parsed.data

    const { data: targetProfile, error: targetProfileError } =
      await supabaseAdmin
        .from('profiles')
        .select('id, student_id, full_name, role, enrollment_status')
        .eq('id', userId)
        .maybeSingle()

    if (targetProfileError) {
      return jsonNoStore(
        { error: '대상 계정 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (!targetProfile) {
      return jsonNoStore(
        { error: '대상 계정을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (targetProfile.enrollment_status === enrollmentStatus) {
      return jsonNoStore(
        {
          ok: true,
          message: '이미 동일한 상태입니다.',
          user: targetProfile,
        },
        { status: 200 }
      )
    }

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        enrollment_status: enrollmentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id, student_id, full_name, role, cohort_no, enrollment_status, created_at, updated_at')
      .single()

    if (updateError) {
      return jsonNoStore(
        { error: '재학/수료 상태 변경에 실패했습니다.' },
        { status: 500 }
      )
    }

    await writeAdminAuditLog({
      actorUserId: authResult.user.id,
      targetUserId: userId,
      action: 'admin.user_enrollment_status.update',
      metadata: {
        client_ip: clientIp,
        target_student_id: targetProfile.student_id,
        target_full_name: targetProfile.full_name,
        before: targetProfile.enrollment_status,
        after: enrollmentStatus,
      },
    })

    return jsonNoStore(
      {
        ok: true,
        message: '재학/수료 상태가 변경되었습니다.',
        user: updatedProfile,
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

    console.error('[admin/users/update-enrollment-status] unexpected error:', error)

    return jsonNoStore(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
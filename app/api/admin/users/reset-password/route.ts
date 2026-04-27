// app/api/admin/users/reset-password/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'
import { writeAdminAuditLog } from '@/lib/admin-audit'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 72

const resetPasswordSchema = z.object({
  user_id: z.string().uuid('사용자 ID가 올바르지 않습니다.'),
  password: z.string(),
})

function validateStrongPassword(params: {
  password: string
  studentId?: string
  fullName?: string
}): string | null {
  const { password, studentId, fullName } = params

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `비밀번호는 최소 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `비밀번호는 최대 ${PASSWORD_MAX_LENGTH}자까지 허용됩니다.`
  }

  if (/\s/.test(password)) {
    return '비밀번호에는 공백을 사용할 수 없습니다.'
  }

  if (!/[a-z]/.test(password)) {
    return '비밀번호에는 소문자가 최소 1개 포함되어야 합니다.'
  }

  if (!/\d/.test(password)) {
    return '비밀번호에는 숫자가 최소 1개 포함되어야 합니다.'
  }

  if (studentId && password.includes(studentId)) {
    return '비밀번호에는 학번을 포함할 수 없습니다.'
  }

  const normalizedPassword = password.toLowerCase()
  const normalizedFullName = fullName?.trim().toLowerCase()

  if (
    normalizedFullName &&
    normalizedFullName.length >= 2 &&
    normalizedPassword.includes(normalizedFullName)
  ) {
    return '비밀번호에는 이름을 포함할 수 없습니다.'
  }

  return null
}

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
      `admin:reset-password:ip:${clientIp}`,
      10,
      300
    )

    if (!rateLimit.ok) {
      await writeAdminAuditLog({
        actorUserId: authResult.user.id,
        action: 'admin.user_password_reset.blocked.rate_limit',
        metadata: {
          client_ip: clientIp,
          retry_after_seconds: rateLimit.resetInSeconds,
        },
      })

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
    const parsed = resetPasswordSchema.safeParse(rawBody)

    if (!parsed.success) {
      return jsonNoStore(
        {
          error: '입력값이 올바르지 않습니다.',
          field_errors: parsed.error.flatten().fieldErrors,
          form_errors: parsed.error.flatten().formErrors,
        },
        { status: 400 }
      )
    }

    const { user_id: userId, password } = parsed.data

    const { data: targetProfile, error: targetProfileError } =
      await supabaseAdmin
        .from('profiles')
        .select('id, student_id, full_name, role')
        .eq('id', userId)
        .maybeSingle()

    if (targetProfileError) {
      console.error('[admin/users/reset-password] profile query error:', targetProfileError)

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

    const passwordError = validateStrongPassword({
      password,
      studentId: targetProfile.student_id,
      fullName: targetProfile.full_name,
    })

    if (passwordError) {
      return jsonNoStore(
        {
          error: '비밀번호 정책에 맞지 않습니다.',
          field_errors: {
            password: [passwordError],
          },
        },
        { status: 400 }
      )
    }

    const { error: updateAuthError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
      })

    if (updateAuthError) {
      console.error('[admin/users/reset-password] auth update error:', updateAuthError)

      await writeAdminAuditLog({
        actorUserId: authResult.user.id,
        targetUserId: userId,
        action: 'admin.user_password_reset.error.auth_update_failed',
        metadata: {
          client_ip: clientIp,
          target_student_id: targetProfile.student_id,
          target_role: targetProfile.role,
          error: updateAuthError.message,
        },
      })

      return jsonNoStore(
        { error: '비밀번호 변경에 실패했습니다.' },
        { status: 500 }
      )
    }

    await writeAdminAuditLog({
      actorUserId: authResult.user.id,
      targetUserId: userId,
      action: 'admin.user_password_reset.success',
      metadata: {
        client_ip: clientIp,
        target_student_id: targetProfile.student_id,
        target_full_name: targetProfile.full_name,
        target_role: targetProfile.role,
      },
    })

    return jsonNoStore(
      {
        ok: true,
        message: '비밀번호가 변경되었습니다.',
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

    console.error('[admin/users/reset-password] unexpected error:', error)

    return jsonNoStore(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
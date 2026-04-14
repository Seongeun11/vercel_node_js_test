// app/api/admin/users/create/route.ts

import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { studentIdToEmail } from '@/lib/auth-email'
import { adminUserCreateSchema } from '@/lib/validations/admin-user'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'
import { writeAdminAuditLog } from '@/lib/admin-audit'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

function normalizeSupabaseAuthError(message?: string): string {
  if (!message) return '사용자 생성 실패'

  if (
    message.includes('already been registered') ||
    message.includes('User already registered')
  ) {
    return '이미 생성된 계정입니다.'
  }

  if (message.includes('Password')) {
    return '비밀번호 정책에 맞지 않습니다.'
  }

  return message
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)

  try {
    // 1) CSRF 방어
    assertSameOrigin(request)

    // 2) 관리자 권한 확인
    const authResult = await requireRole(['admin'])

    if (!authResult.ok || !authResult.user) {
      return jsonNoStore(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    // 3) 요청 본문 검증
    const rawBody = await request.json()
    const parsed = adminUserCreateSchema.safeParse(rawBody)

    if (!parsed.success) {
      await writeAdminAuditLog({
        actorUserId: authResult.user.id,
        action: 'admin.user_create.blocked.validation_error',
        metadata: {
          client_ip: clientIp,
          issues: parsed.error.flatten(),
        },
      })

      return jsonNoStore(
        {
          error: '입력값이 올바르지 않습니다.',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const {
      student_id: studentId,
      password,
      full_name: fullName,
      role,
    } = parsed.data

    const email = studentIdToEmail(studentId)

    // 4) Rate limit - IP 기준
    const ipRateLimit = await checkRateLimit(
      `admin:create-user:ip:${clientIp}`,
      10,
      60
    )

    if (!ipRateLimit.ok) {
      await writeAdminAuditLog({
        actorUserId: authResult.user.id,
        action: 'admin.user_create.blocked.rate_limit_ip',
        metadata: {
          client_ip: clientIp,
          student_id: studentId,
          retry_after_seconds: ipRateLimit.resetInSeconds,
        },
      })

      return jsonNoStore(
        {
          error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(ipRateLimit.resetInSeconds),
          },
        }
      )
    }

    // 5) Rate limit - 학번 기준
    const studentRateLimit = await checkRateLimit(
      `admin:create-user:student:${studentId}`,
      5,
      300
    )

    if (!studentRateLimit.ok) {
      await writeAdminAuditLog({
        actorUserId: authResult.user.id,
        action: 'admin.user_create.blocked.rate_limit_student',
        metadata: {
          client_ip: clientIp,
          student_id: studentId,
          retry_after_seconds: studentRateLimit.resetInSeconds,
        },
      })

      return jsonNoStore(
        {
          error: '해당 학번에 대한 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(studentRateLimit.resetInSeconds),
          },
        }
      )
    }

    // 6) 학번 중복 체크
    const { data: existingProfile, error: existingProfileError } =
      await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('student_id', studentId)
        .maybeSingle()

    if (existingProfileError) {
      console.error('[PROFILE_DUP_CHECK_ERROR]', existingProfileError)

      await writeAdminAuditLog({
        actorUserId: authResult.user.id,
        action: 'admin.user_create.error.profile_dup_check',
        metadata: {
          client_ip: clientIp,
          student_id: studentId,
          error: existingProfileError.message,
        },
      })

      return jsonNoStore(
        { error: '학번 중복 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (existingProfile) {
      await writeAdminAuditLog({
        actorUserId: authResult.user.id,
        action: 'admin.user_create.blocked.duplicate_student_id',
        metadata: {
          client_ip: clientIp,
          student_id: studentId,
        },
      })

      return jsonNoStore(
        { error: '이미 존재하는 학번입니다.' },
        { status: 409 }
      )
    }

    // 7) Auth 유저 생성
    const { data: createdAuth, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          student_id: studentId,
          full_name: fullName,
          role,
        },
      })

    if (createAuthError || !createdAuth.user) {
      await writeAdminAuditLog({
        actorUserId: authResult.user.id,
        action: 'admin.user_create.error.auth_create_failed',
        metadata: {
          client_ip: clientIp,
          student_id: studentId,
          email,
          error: createAuthError?.message ?? 'unknown',
        },
      })

      return jsonNoStore(
        { error: normalizeSupabaseAuthError(createAuthError?.message) },
        { status: 400 }
      )
    }

    // 8) Trigger 결과 검증
    const { data: createdProfile, error: createdProfileError } =
      await supabaseAdmin
        .from('profiles')
        .select('id, student_id, full_name, role, created_at')
        .eq('id', createdAuth.user.id)
        .maybeSingle()

    if (createdProfileError || !createdProfile) {
      console.error('[PROFILE_TRIGGER_CREATE_ERROR]', createdProfileError)

      // Auth만 생성되고 profile이 없으면 롤백
      await supabaseAdmin.auth.admin.deleteUser(createdAuth.user.id)

      await writeAdminAuditLog({
        actorUserId: authResult.user.id,
        action: 'admin.user_create.error.profile_trigger_failed',
        metadata: {
          client_ip: clientIp,
          student_id: studentId,
          email,
          auth_user_id: createdAuth.user.id,
          error: createdProfileError?.message ?? 'profile_not_created',
        },
      })

      return jsonNoStore(
        { error: '프로필 자동 생성에 실패했습니다. 트리거 설정을 확인해주세요.' },
        { status: 500 }
      )
    }

    // 9) 성공 감사 로그
    await writeAdminAuditLog({
      actorUserId: authResult.user.id,
      action: 'admin.user_create.success',
      targetUserId: createdProfile.id,
      metadata: {
        client_ip: clientIp,
        student_id: createdProfile.student_id,
        full_name: createdProfile.full_name,
        role: createdProfile.role,
        email,
      },
    })

    return jsonNoStore(
      {
        ok: true,
        user: {
          id: createdProfile.id,
          student_id: createdProfile.student_id,
          full_name: createdProfile.full_name,
          role: createdProfile.role,
          created_at: createdProfile.created_at,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    //console.error('[ADMIN_USER_CREATE_ERROR]', error)

    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }
  }
}
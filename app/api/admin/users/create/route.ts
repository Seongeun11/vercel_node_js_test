import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { studentIdToEmail } from '@/lib/auth-email'
import { adminUserCreateSchema } from '@/lib/validations/admin-user'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'
import { writeAdminAuditLog } from '@/lib/admin-audit'

function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true

  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
  ].filter(Boolean) as string[]

  return allowedOrigins.includes(origin)
}

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
    // 1) 관리자 권한 확인
    const authResult = await requireRole(['admin'])

    if (!authResult.ok || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    // 2) Origin 검사
    if (!isAllowedOrigin(request)) {
      await writeAdminAuditLog({
        actorUserId: authResult.user.id,
        action: 'admin.user_create.blocked.invalid_origin',
        metadata: { client_ip: clientIp },
      })

      return NextResponse.json(
        { error: '허용되지 않은 요청 출처입니다.' },
        { status: 403 }
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

      return NextResponse.json(
        {
          error: '입력값이 올바르지 않습니다.',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { student_id: studentId, password, full_name: fullName, role } = parsed.data
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

      return NextResponse.json(
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

      return NextResponse.json(
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

      return NextResponse.json(
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

      return NextResponse.json(
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

      return NextResponse.json(
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

      return NextResponse.json(
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

    return NextResponse.json(
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
    console.error('[ADMIN_USER_CREATE_ERROR]', error)

    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
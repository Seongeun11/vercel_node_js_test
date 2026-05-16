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

    // 3) 요청 본문 검증 (Zod 스키마를 통한 타입 변환)
    const rawBody = await request.json()
    // [로그 추가] 클라이언트에서 보낸 원본 데이터 확인
    console.log('[DEBUG] Request Body:', JSON.stringify(rawBody, null, 2))
    const parsed = adminUserCreateSchema.safeParse(rawBody)

    if (!parsed.success) {
      // 검증 실패 시 에러 처리 (기존 로직 유지)
      // [로그 추가] 유효성 검사 실패 상세 원인 출력
      //console.error('[VALIDATION_ERROR]', parsed.error.format())
      //return jsonNoStore({ error: '입력값이 올바르지 않습니다.', details: parsed.error.format() }, { status: 400 })
    
      const flattened = parsed.error.flatten()

      await writeAdminAuditLog({
        actorUserId: authResult.user.id,
        action: 'admin.user_create.blocked.validation_error',
        metadata: {
          client_ip: clientIp,
          issues: flattened,
        },
      })

      return jsonNoStore(
        {
          error: '입력값이 올바르지 않습니다.',
          field_errors: flattened.fieldErrors,
      form_errors: flattened.formErrors,
        },
        { status: 400 }
      )
    }

    // 2. 구조 분해 할당 시 변수 추출
// Zod의 coerce.number() 덕분에 role_id와 affiliation_id는 이미 'number' 타입입니다.
const {
  student_id: studentId,
  password,
  full_name: fullName,
  role_id,          // 명확한 숫자형
  affiliation_id,   // 명확한 숫자형
  cohort_no: cohortNo,
  enrollment_status: enrollmentStatus,
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
    // [로그 추가] 변환된 데이터 타입 확인 (number여야 함)
    console.log(`변환된 데이터 타입 확인[DEBUG] Converted Types - role_id: ${typeof role_id}, affiliation_id: ${typeof affiliation_id}`)
    // 7) Auth 유저 생성
    const { data: createdAuth, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
        student_id: studentId,
        full_name: fullName,
        role_id: role_id,           // 정규화된 ID 전달
        affiliation_id: affiliation_id, // 정규화된 ID 전달
        cohort_no: cohortNo,
        enrollment_status: enrollmentStatus,
       
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

 // 8) Trigger 결과 검증 (Join 쿼리 수정)
const { data: createdProfile, error: createdProfileError } =
  await supabaseAdmin
    .from('profiles')
    .select(`
      id,
      student_id,
      full_name,
      cohort_no,
      enrollment_status,
      created_at,
      roles!inner ( name ), 
      affiliations!inner ( name ) 
    `)
    .eq('id', createdAuth.user.id)
    .maybeSingle()

// 파싱 에러가 해결되면 아래 createdProfile.id에 대한 에러도 사라집니다.
if (createdProfileError || !createdProfile) {
  console.error('[PROFILE_CREATE_ERROR]', createdProfileError)
  
  // 실패 시 Auth 유저 삭제 (롤백)
  await supabaseAdmin.auth.admin.deleteUser(createdAuth.user.id)

  return jsonNoStore(
    { error: '프로필 연동에 실패했습니다.' },
    { status: 500 }
  )
}

// 9) 성공 응답 데이터 구성 (Join 데이터를 클라이언트 형식으로 변환)
// 중첩된 객체를 단일 필드로 매핑하여 전달합니다.
// 9) 성공 응답 데이터 구성 (Join 데이터를 클라이언트 형식으로 평탄화)
// TypeScript 에러를 방지하기 위해 단일 객체 구조로 접근합니다.
const finalUser = {
  id: createdProfile.id,
  student_id: createdProfile.student_id,
  full_name: createdProfile.full_name,
  cohort_no: createdProfile.cohort_no,
  enrollment_status: createdProfile.enrollment_status,
  created_at: createdProfile.created_at,
  // Join된 테이블의 데이터를 단일 필드로 변환
  role: (createdProfile.roles as any)?.name,
  affiliation: (createdProfile.affiliations as any)?.name,
};

return jsonNoStore(
  {
    ok: true,
    user: finalUser,
  },
  { status: 201 }
)
  }catch (error) {
    //console.error('[ADMIN_USER_CREATE_ERROR]', error)

    if (error instanceof Error && error.message === 'CSRF_BLOCKED') {
      return jsonNoStore(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 }
      )
    }

    // [로그 추가] 최종 예외 핸들러
    console.error('최종 예외 핸들러[CRITICAL_SERVER_ERROR]', error)
    return jsonNoStore(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
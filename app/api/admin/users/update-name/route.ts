import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'
import { writeAdminAuditLog } from '@/lib/admin-audit'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

// 유효성 검사를 위한 스키마 구성
const updateNameSchema = z.object({
  user_id: z.string().uuid('사용자 ID가 올바르지 않습니다.'),
  full_name: z
    .string()
    .min(2, '이름은 최소 2자 이상이어야 합니다.')
    .max(50, '이름은 최대 50자까지 입력 가능합니다.')
    .transform((val) => val.trim()), // 공백 자동 제거
})

const profileQuery = `
  id,
  student_id,
  full_name,
  cohort_no,
  enrollment_status,
  created_at,
  updated_at,
  role:roles(
    id,
    name
  )
`

// 이름 내 허용되지 않는 특수문자나 공백을 추가로 방어하기 위한 추가 검증 논리
function validateNameFormat(fullName: string): string | null {
  if (/\s/.test(fullName)) {
    return '이름에는 공백을 사용할 수 없습니다.'
  }
  // 한글, 영문 대소문자만 허용하는 검증 논리 (자유도에 따라 조절 가능)
  const nameRegex = /^[a-zA-Z가-힣]+$/
  if (!nameRegex.test(fullName)) {
    return '이름에는 한글과 영문자만 사용할 수 있습니다.'
  }
  return null
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)

  try {
    // 1. CSRF 보안 검증
    assertSameOrigin(request)

    // 2. 관리자 권한 검증
    const authResult = await requireRole(['admin'])
    if (!authResult.ok || !authResult.user) {
      return jsonNoStore(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    // 3. API 속도 제한 (Rate Limit) 적용
    const rateLimit = await checkRateLimit(
      `admin:update-name:ip:${clientIp}`,
      20, // 이름 변경은 상대적으로 비밀번호 초기화보다 유연하게 20회/5분 할당
      300
    )

    if (!rateLimit.ok) {
      await writeAdminAuditLog({
        actorUserId: authResult.user.id,
        action: 'admin.user_name_update.blocked.rate_limit',
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

    // 4. 요청 Body 파싱 및 Zod Schema 유효성 검사
    const rawBody = await request.json()
    const parsed = updateNameSchema.safeParse(rawBody)

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

    const { user_id: userId, full_name: fullName } = parsed.data

    // 이름의 형식 및 글자 규칙 추가 검사
    const formatError = validateNameFormat(fullName)
    if (formatError) {
      return jsonNoStore(
        {
          error: '올바르지 않은 이름 형식입니다.',
          field_errors: {
            full_name: [formatError],
          },
        },
        { status: 400 }
      )
    }

    // 5. 대상 사용자 프로필 선조회
    const { data: targetProfile, error: targetProfileError } =
      await supabaseAdmin
        .from('profiles')
        .select(profileQuery)
        .eq('id', userId)
        .maybeSingle()

    if (targetProfileError) {
      console.error('[admin/users/update-name] profile query error:', targetProfileError)
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

    // 현재 저장된 이름과 완전히 같다면 DB 변경을 생략하고 얼리 리턴
    if (targetProfile.full_name === fullName) {
      return jsonNoStore(
        { error: '현재 이름과 동일합니다.', field_errors: { full_name: ['현재 이름과 동일합니다.'] } },
        { status: 400 }
      )
    }

    // 6. DB 업데이트 진행 (profiles 테이블의 full_name 필드 변경)
    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select(profileQuery)
      .single()

    if (updateError) {
      console.error('[admin/users/update-name] database update error:', updateError)

      await writeAdminAuditLog({
        actorUserId: authResult.user.id,
        targetUserId: userId,
        action: 'admin.user_name_update.error.db_update_failed',
        metadata: {
          client_ip: clientIp,
          target_student_id: targetProfile.student_id,
          target_current_name: targetProfile.full_name,
          attempted_name: fullName,
          error: updateError.message,
        },
      })

      return jsonNoStore(
        { error: '이름 변경 처리에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 7. 성공 시 감사 로그 작성 및 반환
    await writeAdminAuditLog({
      actorUserId: authResult.user.id,
      targetUserId: userId,
      action: 'admin.user_name_update.success',
      metadata: {
        client_ip: clientIp,
        target_student_id: targetProfile.student_id,
        old_name: targetProfile.full_name,
        new_name: fullName,
        target_role: targetProfile.role,
      },
    })

    return jsonNoStore(
      {
        ok: true,
        message: '이름이 변경되었습니다.',
        user: updatedProfile, // 업데이트된 전체 프로필 객체를 전달하여 UI에 즉시 동기화가 가능하도록 처리
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

    console.error('[admin/users/update-name] unexpected error:', error)
    return jsonNoStore(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
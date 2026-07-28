//app\api\admin\users\update-profile\route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/request-ip'
import { writeAdminAuditLog } from '@/lib/admin-audit'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

const updateProfileSchema = z.object({
  user_id: z.string().uuid('사용자 ID가 올바르지 않습니다.'),
  student_id: z.string().min(1, '학번을 입력해주세요.').transform((v) => v.trim()),
  full_name: z.string().min(2, '이름은 최소 2자 이상이어야 합니다.').transform((v) => v.trim()),
  role_id: z.number().int().positive('권한 선택이 올바르지 않습니다.'),
  affiliation_id: z.number().int().positive('소속 선택이 올바르지 않습니다.'),
  cohort_no: z.number().int().positive().nullable(),
})

const profileQuery = `
  id,
  student_id,
  full_name,
  cohort_no,
  enrollment_status,
  created_at,
  updated_at,
  roles ( id, name ),
  affiliations ( id, name )
`

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)

  try {
    assertSameOrigin(request)

    const authResult = await requireRole(['admin'])
    if (!authResult.ok || !authResult.user) {
      return jsonNoStore({ error: authResult.error }, { status: authResult.status })
    }

    const rateLimit = await checkRateLimit(`admin:update-profile:ip:${clientIp}`, 30, 300)
    if (!rateLimit.ok) {
      return jsonNoStore(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.resetInSeconds) } }
      )
    }

    const rawBody = await request.json()
    const parsed = updateProfileSchema.safeParse(rawBody)

    if (!parsed.success) {
      return jsonNoStore(
        {
          error: '입력값이 올바르지 않습니다.',
          field_errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const { user_id: userId, student_id, full_name, role_id, affiliation_id, cohort_no } = parsed.data

    // 1. 대상 사용자 조회
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, student_id, full_name, role_id, affiliation_id, cohort_no')
      .eq('id', userId)
      .maybeSingle()

    if (targetError || !targetProfile) {
      return jsonNoStore({ error: '대상 계정을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 2. 학번 변경 시 중복 검사
    if (targetProfile.student_id !== student_id) {
      const { data: duplicateUser } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('student_id', student_id)
        .neq('id', userId)
        .maybeSingle()

      if (duplicateUser) {
        return jsonNoStore(
          { error: '이미 존재하는 학번입니다.', field_errors: { student_id: ['이미 사용 중인 학번입니다.'] } },
          { status: 400 }
        )
      }
    }
    // 6. 💡 [핵심] Supabase Auth 계정 정보 업데이트 (이메일 및 user_metadata.full_name 동기화)
    const authUpdatePayload: { email?: string; email_confirm?: boolean; user_metadata?: Record<string, any> } = {}

    // 6-1. 학번이 변경된 경우 -> 내부 이메일 변경
    if (targetProfile.student_id !== student_id) {
      authUpdatePayload.email = `${student_id}@club.local`
      authUpdatePayload.email_confirm = true // 관리자 수정이므로 이메일 인증 절차 건너뜀
    }

    // 6-2. 이름이 변경된 경우 -> user_metadata.full_name 업데이트
    if (targetProfile.full_name !== full_name) {
      authUpdatePayload.user_metadata = {
        full_name: full_name,
      }
    }

    // Auth 업데이트 항목이 존재하는 경우 Supabase Auth Admin API 호출
    if (Object.keys(authUpdatePayload).length > 0) {
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        authUpdatePayload
      )

      if (authUpdateError) {
        console.error('[admin/users/update-profile] Supabase Auth Update Error:', authUpdateError)
        return jsonNoStore(
          { error: `인증 계정(Auth) 업데이트에 실패했습니다: ${authUpdateError.message}` },
          { status: 400 }
        )
      }
    }
    // 3. 프로필 정보 업데이트
    const { data: updatedRaw, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        student_id,
        full_name,
        role_id,
        affiliation_id,
        cohort_no,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select(profileQuery)
      .single()

    if (updateError) {
      console.error('[admin/users/update-profile] update error:', updateError)
      return jsonNoStore({ error: '회원 정보 수정에 실패했습니다.' }, { status: 500 })
    }

    // 4. 프론트엔드 데이터 구조 평탄화 (AdminUser 타입과 동기화)
    const updatedUser = {
      id: updatedRaw.id,
      student_id: updatedRaw.student_id,
      full_name: updatedRaw.full_name,
      cohort_no: updatedRaw.cohort_no,
      enrollment_status: updatedRaw.enrollment_status,
      role: updatedRaw.roles,
      affiliation: (updatedRaw.affiliations as any)?.name || '미지정',
      affiliation_id: (updatedRaw.affiliations as any)?.id,
    }

    // 5. Audit Log 기록
    await writeAdminAuditLog({
      actorUserId: authResult.user.id,
      targetUserId: userId,
      action: 'admin.user_profile.update',
      metadata: {
        client_ip: clientIp,
        before: targetProfile,
        after: { student_id, full_name, role_id, affiliation_id, cohort_no },
      },
    })

    return jsonNoStore({ ok: true, message: '회원 정보가 수정되었습니다.', user: updatedUser }, { status: 200 })
  } catch (error) {
    console.error('[admin/users/update-profile] unexpected error:', error)
    return jsonNoStore({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
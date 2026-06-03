// lib/serverAuth.ts
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type AppRole = 'admin' | 'captain' | 'trainee'

export type CurrentUser = {
  id: string
  full_name: string
  student_id: string
  role: AppRole
}

/**
 * 현재 인증된 사용자의 상세 프로필 정보를 가져옵니다.
 * DB 정규화에 따라 roles 테이블과 Join하여 권한 이름을 추출합니다.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const supabase = await createSupabaseServerClient()

    // 1) Auth 세션에서 유저 정보 확인
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    // 2) [수정 핵심] profiles와 roles 테이블 Join 쿼리 실행
    // 기존 'role' 컬럼 대신 'roles!inner(name)'를 사용하여 관계 데이터 조회
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id, 
        full_name, 
        student_id, 
        roles!inner ( name )
      `)
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[GET_CURRENT_USER_PROFILE_ERROR]', profileError)
      }
      return null
    }

    // 3) [수정 핵심] 중첩된 객체를 평탄화하여 CurrentUser 형식으로 리턴
    return {
      id: profile.id,
      full_name: profile.full_name,
      student_id: profile.student_id,
      // roles.name을 role 필드로 할당 (TypeScript 에러 방지를 위해 as any 사용)
      role: (profile.roles as any)?.name as AppRole
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[GET_CURRENT_USER_UNEXPECTED_ERROR]', error)
    }
    return null
  }
}

/**
 * 특정 역할이 필요한 페이지나 API에서 권한을 검사합니다.
 */
export async function requireRole(allowedRoles: AppRole[]) {
  const user = await getCurrentUser()

  if (!user) {
    return {
      ok: false as const,
      status: 401,
      error: '로그인이 필요합니다.',
    }
  }

  // 이제 user.role은 가공된 문자열이므로 기존 로직이 그대로 작동합니다.
  if (!allowedRoles.includes(user.role)) {
    return {
      ok: false as const,
      status: 403,
      error: '권한이 없습니다.',
    }
  }

  return {
    ok: true as const,
    user,
  }
}
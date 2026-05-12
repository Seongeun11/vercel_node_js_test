// lib/server-session.ts
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type UserRole = 'admin' | 'captain' | 'trainee'

export type SessionProfile = {
  id: string
  student_id: string
  full_name: string
  role: UserRole // 가공된 최종 역할 문자열을 담습니다.
}

export type SessionSuccess = {
  ok: true
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  user: {
    id: string
    email?: string | null
  }
  profile: SessionProfile
}

export type SessionFailure = {
  ok: false
  status: 401 | 403
  error: string
}

export type SessionResult = SessionSuccess | SessionFailure

export async function getSessionProfile(
  allowedRoles?: UserRole[]
): Promise<SessionResult> {
  try {
    const supabase = await createSupabaseServerClient()
    
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        ok: false,
        status: 401,
        error: '인증이 필요합니다.',
      }
    }

    // 2. [수정 포인트] DB 조인 전, 토큰의 메타데이터에서 role을 먼저 확인합니다.
    // 보내주신 토큰 구조상 user.user_metadata.role에 'trainee'가 들어있습니다.
    const tokenRole = user.user_metadata?.role as UserRole;

    // 1) 쿼리 수정: role 대신 roles!inner(name) 사용
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id, 
        student_id, 
        full_name, 
        roles( name )
      `)
      .eq('id', user.id)
      .maybeSingle()
// DB 조회에 실패하더라도 토큰 정보가 있다면 일단 통과시키는 유연한 로직
    const finalRole = (profileData?.roles as any)?.name || tokenRole;
    if (profileError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[GET_SESSION_PROFILE_ERROR]', profileError)
      }
      return {
        ok: false,
        status: 403,
        error: '프로필 조회에 실패했습니다.',
      }
    }

    if (!profileData) {
      return {
        ok: false,
        status: 403,
        error: '프로필을 찾을 수 없습니다.',
      }
    }

  
    // [수정 포인트] Supabase 조인 결과는 배열로 올 수 있으므로 안전하게 처리합니다.
    const rawRole = profileData.roles;
    let roleName: string | undefined;

    if (Array.isArray(rawRole)) {
          roleName = rawRole[0]?.name;
        } else if (rawRole && typeof rawRole === 'object') {
          roleName = (rawRole as any).name;
        }

          // 2) 데이터 평탄화 (Flattening)
    // 조인된 객체에서 name만 추출하여 기존의 role 형식으로 맞춥니다.
    const profile: SessionProfile = {
      id: profileData.id,
      student_id: profileData.student_id,
      full_name: profileData.full_name,
      role: (profileData.roles as any)?.name as UserRole, // 'admin', 'captain', 'trainee' 중 하나가 담김
    }


// 권한 검사 전 로그 확인 (개발 환경)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AUTH_CHECK] User: ${profile.full_name}, Role: ${profile.role}`);
    }


    // 3) 권한 검사 (업데이트된 profile.role 사용)
    if (
      Array.isArray(allowedRoles) &&
      allowedRoles.length > 0 &&
      !allowedRoles.includes(profile.role)
    ) {
      return {
        ok: false,
        status: 403,
        error: '권한이 없습니다.',
      }
    }

    return {
      ok: true,
      supabase,
      user: {
        id: user.id,
        email: user.email,
      },
      profile,
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[GET_SESSION_PROFILE_UNEXPECTED_ERROR]', error)
    }

    return {
      ok: false,
      status: 401,
      error: '인증 처리 중 오류가 발생했습니다.',
    }
  }
}
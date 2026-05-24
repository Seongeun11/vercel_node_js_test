// lib/server-session.ts
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type UserRole = 'admin' | 'captain' | 'trainee'

export type SessionProfile = {
  id: string
  student_id: string
  full_name: string
  role: UserRole
}

export type SessionSuccess = {
  ok: true
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  user: {
    id: string
    email?: string | null
  }
  profile: SessionProfile
  //[추가] 토큰 정보 필드 명시
  accessToken: string
  refreshToken: string
}

export type SessionFailure = {
  ok: false
  status: 401 | 403
  error: string
}

export type SessionResult = SessionSuccess | SessionFailure

type RoleJoin =
  | {
      name: UserRole
    }
  | {
      name: UserRole
    }[]
  | null

type ProfileRow = {
  id: string
  student_id: string
  full_name: string
  roles: RoleJoin
}

export async function getSessionProfile(
  allowedRoles?: UserRole[]
): Promise<SessionResult> {
  try {
    const supabase = await createSupabaseServerClient()

    // 🚀 [변경] getUser() 대신 getSession()을 사용하여 토큰에 접근
    const { data: sessionData, error: authError } = await supabase.auth.getSession()

    if (authError || !sessionData.session) {
      return {
        ok: false,
        status: 401,
        error: '인증이 필요합니다.',
      }
    }
    const user = sessionData.session.user; // 세션에서 유저 정보 추출
    // 토큰 role은 fallback 용도
    const tokenRole =
      user.user_metadata?.role as UserRole | undefined

    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        student_id,
        full_name,
        roles(name)
      `)
      .eq('id', user.id)
      .single()

    if (error || !data) {
      console.error(
        '[GET_SESSION_PROFILE_ERROR]',
        error
      )

      return {
        ok: false,
        status: 403,
        error: '프로필 조회 실패',
      }
    }

    const profileData = data as ProfileRow

    let roleName: UserRole | undefined

    if (Array.isArray(profileData.roles)) {
      roleName = profileData.roles[0]?.name
    } else {
      roleName = profileData.roles?.name
    }

    const finalRole =
      roleName ??
      tokenRole ??
      'trainee'

    const profile: SessionProfile = {
      id: profileData.id,
      student_id: profileData.student_id,
      full_name: profileData.full_name,
      role: finalRole,
    }

    if (
      process.env.NODE_ENV !== 'production'
    ) {
      console.log(
        `[AUTH] ${profile.full_name} (${profile.role})`
      )
    }

    if (
      allowedRoles?.length &&
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
      //[추가] 세션에서 토큰 주입
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
    }
  } catch (err) {
    console.error(
      '[GET_SESSION_PROFILE_UNEXPECTED]',
      err
    )

    return {
      ok: false,
      status: 401,
      error: '인증 처리 중 오류가 발생했습니다',
    }
  }
}
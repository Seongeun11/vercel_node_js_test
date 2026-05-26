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
  | { name: UserRole }
  | { name: UserRole }[]
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

    //  [보안 개선 핵심]: getSession()을 단독 신뢰하지 않고, 
    // getUser()를 통해 Supabase Auth 서버에 위조 여부를 먼저 강력하게 검증받습니다.
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return {
        ok: false,
        status: 401,
        error: '인증이 만료되었거나 올바르지 않습니다.',
      }
    }

    const verifiedUser = userData.user

    // [논리 보완]: 검증이 완료된 시점에 한하여, 
    // 하위 비즈니스 로직에 필요한 토큰 데이터를 세션 스토리지에서 안전하게 읽어옵니다.
    const { data: sessionData } = await supabase.auth.getSession()
    const currentSession = sessionData?.session

    if (!currentSession) {
      return {
        ok: false,
        status: 401,
        error: '유효한 세션 토큰을 찾을 수 없습니다.',
      }
    }

    // 토큰 역할을 백백용 Fallback으로 설정
    const tokenRole = verifiedUser.user_metadata?.role as UserRole | undefined

    // DB 프로필 조회 및 권한 검사 진행
    const { data, error: dbError } = await supabase
      .from('profiles')
      .select(`
        id,
        student_id,
        full_name,
        roles(name)
      `)
      .eq('id', verifiedUser.id)
      .single()

    if (dbError || !data) {
      console.error('[GET_SESSION_PROFILE_DB_ERROR]', dbError)
      return {
        ok: false,
        status: 403,
        error: '사용자 프로필을 조회할 수 없습니다.',
      }
    }

    const profileData = data as ProfileRow

    // 관계형 데이터 단일/배열 예외 처리의 가독성 단순화
    const dbRoleName = Array.isArray(profileData.roles)
      ? profileData.roles[0]?.name
      : profileData.roles?.name

    const finalRole = dbRoleName ?? tokenRole ?? 'trainee'

    const profile: SessionProfile = {
      id: profileData.id,
      student_id: profileData.student_id,
      full_name: profileData.full_name,
      role: finalRole,
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AUTH VERIFIED] ${profile.full_name} (${profile.role})`)
    }

    // 인가(Authorization) 제어 확인
    if (allowedRoles?.length && !allowedRoles.includes(profile.role)) {
      return {
        ok: false,
        status: 403,
        error: '해당 페이지/API에 접근할 권한이 없습니다.',
      }
    }

    // 완전히 검증된 개체만 주입하여 신뢰성 보장
    return {
      ok: true,
      supabase,
      user: {
        id: verifiedUser.id,
        email: verifiedUser.email,
      },
      profile,
      accessToken: currentSession.access_token,
      refreshToken: currentSession.refresh_token,
    }
  } catch (err) {
    console.error('[GET_SESSION_PROFILE_UNEXPECTED]', err)
    return {
      ok: false,
      status: 401,
      error: '인증 처리 과정 중 예상치 못한 내부 에러가 발생했습니다.',
    }
  }
}
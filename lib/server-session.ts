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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, student_id, full_name, role')
      .eq('id', user.id)
      .maybeSingle()

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

    if (!profile) {
      return {
        ok: false,
        status: 403,
        error: '프로필을 찾을 수 없습니다.',
      }
    }

    // ✅ 핵심 버그 수정: allowedRoles 실제 검사
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
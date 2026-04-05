import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type AppRole = 'admin' | 'captain' | 'trainee'

export type CurrentUser = {
  id: string
  full_name: string
  student_id: string
  role: AppRole
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, student_id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return null
    }

    return profile as CurrentUser
  } catch (error) {
    console.error('[GET_CURRENT_USER_ERROR]', error)
    return null
  }
}

export async function requireRole(allowedRoles: AppRole[]) {
  const user = await getCurrentUser()

  if (!user) {
    return {
      ok: false as const,
      status: 401,
      error: '로그인이 필요합니다.',
    }
  }

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
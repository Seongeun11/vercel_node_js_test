import { createSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type CurrentUser = {
  id: string
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    console.log('[AUTH] getUser error:', error)
    console.log('[AUTH] auth user id:', user?.id ?? null)

    if (error || !user) {
      return null
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, student_id, role')
      .eq('id', user.id)
      .maybeSingle()

    console.log('[AUTH] profileError:', profileError)
    console.log('[AUTH] profile:', profile)

    if (profileError || !profile) {
      return null
    }

    return profile as CurrentUser
  } catch (error) {
    console.error('[AUTH] getCurrentUser fatal:', error)
    return null
  }
}

export async function requireRole(
  allowedRoles: Array<'admin' | 'captain' | 'trainee'>
) {
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
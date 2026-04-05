// lib/serverAuth.ts
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type AuthenticatedUser = {
  id: string
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, student_id, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return null
  }

  return profile as AuthenticatedUser
}

export async function requireRole(allowedRoles: string[]) {
  const user = await getCurrentUser()

  if (!user) {
    return {
      ok: false,
      status: 401,
      error: '로그인이 필요합니다.',
      user: null,
    }
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      ok: false,
      status: 403,
      error: '권한이 없습니다.',
      user,
    }
  }

  return {
    ok: true,
    status: 200,
    error: null,
    user,
  }
}
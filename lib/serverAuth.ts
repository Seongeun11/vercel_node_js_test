import { supabase } from '@/lib/supabaseClient'

export async function getUserRole(userId: string) {
  if (!userId) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

export async function requireRole(userId: string, allowedRoles: string[]) {
  const user = await getUserRole(userId)

  if (!user) {
    return {
      ok: false,
      status: 403,
      error: '사용자 정보를 찾을 수 없습니다.',
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
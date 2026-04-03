import { getSessionUser } from '@/lib/session'

export async function requireRole(allowedRoles: string[]) {
  const user = await getSessionUser()

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

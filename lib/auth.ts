// lib/auth.ts (JS → TS로 바꾸는 걸 강력 추천)

export type AppRole = 'admin' | 'captain' | 'trainee'

export type CurrentUser = {
  id: string
  full_name: string
  student_id: string
  role: AppRole
}

/**
 * 현재 세션 사용자 조회
 */
export async function fetchSessionUser(): Promise<CurrentUser | null> {
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return null
    }

    const result = await response.json()
    return result?.user ?? null
  } catch (error) {
    console.error('세션 사용자 조회 실패:', error)
    return null
  }
}

/**
 * 권한 체크 유틸
 */
export function hasRole(
  user: CurrentUser | null,
  allowedRoles: AppRole[]
): boolean {
  if (!user || !user.role) return false
  return allowedRoles.includes(user.role)
}
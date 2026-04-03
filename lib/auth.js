export function getStoredUser() {
  if (typeof window === 'undefined') return null

  const raw = localStorage.getItem('attendance_user')
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch (error) {
    console.error('저장된 사용자 정보 파싱 실패:', error)
    localStorage.removeItem('attendance_user')
    return null
  }
}

export function setStoredUser(user) {
  if (typeof window === 'undefined') return
  localStorage.setItem('attendance_user', JSON.stringify(user))
}

export function clearStoredUser() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('attendance_user')
}

export async function fetchSessionUser() {
  const response = await fetch('/api/auth/me', {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
  })

  if (!response.ok) {
    clearStoredUser()
    return null
  }

  const result = await response.json()

  if (!result?.user) {
    clearStoredUser()
    return null
  }

  setStoredUser(result.user)
  return result.user
}

export function hasRole(user, allowedRoles) {
  if (!user || !user.role) return false
  return allowedRoles.includes(user.role)
}

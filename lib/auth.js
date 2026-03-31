export function getStoredUser() {
  if (typeof window === 'undefined') return null

  const raw = localStorage.getItem('attendance_user')
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch (error) {
    console.error('저장된 사용자 정보 파싱 실패:', error)
    return null
  }
}

export function hasRole(user, allowedRoles) {
  if (!user || !user.role) return false
  return allowedRoles.includes(user.role)
}
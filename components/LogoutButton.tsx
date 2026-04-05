'use client'

export default function LogoutButton() {
  async function handleLogout() {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        alert('로그아웃에 실패했습니다.')
        return
      }

      window.location.assign('/login')
    } catch (error) {
      console.error('로그아웃 실패:', error)
      alert('로그아웃 중 오류가 발생했습니다.')
    }
  }

  return (
    <button type="button" onClick={handleLogout}>
      로그아웃
    </button>
  )
}
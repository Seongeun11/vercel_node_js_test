'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchSessionUser, hasRole } from '@/lib/auth'

export default function AdminPage() {
  const [user, setUser] = useState(null)
  const router = useRouter()

  useEffect(() => {
    const loadUser = async () => {
      const savedUser = await fetchSessionUser()

      if (!savedUser) {
        router.replace('/login')
        return
      }

      if (!hasRole(savedUser, ['admin'])) {
        alert('관리자만 접근할 수 있습니다.')
        router.replace('/')
        return
      }

      setUser(savedUser)
    }

    loadUser()
  }, [router])

  if (!user) return <div>로딩중...</div>

  return (
    <div style={{ padding: '20px' }}>
      <h2>관리자 페이지</h2>

      <p>
        {user.full_name} 님 / 권한: {user.role}
      </p>

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/')}>메인으로</button>
        <button onClick={() => router.push('/admin/events')}>이벤트 관리</button>
        <button onClick={() => router.push('/logs')}>출석 로그 조회</button>
        <button onClick={() => router.push('/admin/qr')}>
          QR 출석 생성
        </button>
        <button onClick={() => router.push('/admin/attendance')}>
          출석 현황
        </button>
      </div>
    </div>
  )
}
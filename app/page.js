//page.js
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchSessionUser, hasRole, clearStoredUser } from '@/lib/auth'

export default function AttendancePage() {
  const [user, setUser] = useState(null)
  const [currentTime, setCurrentTime] = useState('')
  const router = useRouter()
  const offsetRef = useRef(0)
  const [eventId, setEventId] = useState('')
  const [eventName, setEventName] = useState('')
  
  useEffect(() => {
    const loadUser = async () => {
      const savedUser = await fetchSessionUser()
      if (!savedUser) {
        router.push('/login')
        return
      }
      setUser(savedUser)
    }

    loadUser()
  }, [router])

  useEffect(() => {
    let clockTimer
    let syncTimer

    const formatKST = (date) => {
      return new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(date)
    }

    const syncServerTime = async () => {
      try {
        const clientSend = Date.now()

        const res = await fetch('/api/time', {
          method: 'GET',
          cache: 'no-store',
        })

        const clientReceive = Date.now()
        const data = await res.json()

        const serverTime =
          Number(res.headers.get('x-server-time')) || data.serverTimestamp

        const rtt = clientReceive - clientSend
        const estimatedServerNow = serverTime + rtt / 2

        offsetRef.current = estimatedServerNow - clientReceive

        const updateClock = () => {
          const correctedNow = new Date(Date.now() + offsetRef.current)
          setCurrentTime(formatKST(correctedNow))
        }

        updateClock()

        if (clockTimer) clearInterval(clockTimer)
        clockTimer = setInterval(updateClock, 1000)
      } catch (error) {
        console.error('서버 시간 동기화 실패:', error)
      }
    }

    syncServerTime()
    syncTimer = setInterval(syncServerTime, 60 * 1000)

    return () => {
      if (clockTimer) clearInterval(clockTimer)
      if (syncTimer) clearInterval(syncTimer)
    }
  }, [])

  const handleAttendance = async () => {
    if (!user) {
      alert('로그인 필요')
      return
    }

    try{
    const response = await fetch('/api/attendance/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: '1b2439ee-f380-46d4-981e-4277dadead9b',
      }),
    })

    const result = await response.json()

    if (response.ok) {
      alert(result.message)
    } else {
      alert(result.error|| '출석 처리 실패')
    }
  } catch (error) {
      console.error(error)
      alert('출석 처리 중 오류가 발생했습니다.')
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      clearStoredUser()
      router.replace('/login')
    }
  }  
  
  if (!user) {
    return <div>로딩중...</div>
  }

return (
    <div
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <h2>출석 체크</h2>

      <p>
        {user.full_name} ({user.student_id}) 님 환영합니다
      </p>

      <p>권한: {user.role}</p>

      <p>현재 시간(서버 동기화): {currentTime}</p>

      <div
        style={{
          display: 'flex',
          padding: '20px',
          gap: '12px',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        
        {hasRole(user, ['admin', 'captain']) && (
          <button onClick={() => router.push('/logs')}>
            수정 이력 조회
          </button>
        )}
        {hasRole(user, ['admin', 'captain']) && (
          <button onClick={() => router.push('/attendance/edit')}>
            출석 수정
          </button>
        )}

        {hasRole(user, ['admin']) && (
          <button onClick={() => router.push('/admin')}>
            관리자 페이지
          </button>
        )}

        <button onClick={handleLogout}>로그아웃</button>
      </div>
    </div>
  )
}
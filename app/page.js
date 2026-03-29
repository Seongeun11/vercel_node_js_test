'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AttendancePage() {
  const [user, setUser] = useState(null)
  const router = useRouter()

  /*
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
      }
    }

    checkUser()
  }, [])
*/


  useEffect(() => { 
    const saveUser = localStorage.getItem('attendance_user')
    if (!saveUser) {
      router.push('/login')
    }
    else {
      setUser(JSON.parse(saveUser))
    }

  }, [])
   
  // 🔥 ⭐ 여기 추가 (핵심)
  const handleAttendance = async () => {
    if (!user){
      alert('로그인 필요')
      return
    }

    /*
    // 1. 세션 가져오기
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      alert('로그인 필요')
      return
    }
*/
    // 2. API 호출
    const response = await fetch('/api/attendance/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        //Authorization: `Bearer ${session.access_token}`, // ⭐ 핵심 이메일 인증
      },
      body: JSON.stringify({
        event_id: '1b2439ee-f380-46d4-981e-4277dadead9b', // 👉 실제 ID 넣기
        user_id: user.id, // 로컬에 저장된 유저 ID 넣기
      }),
    })

    const result = await response.json()

    if (response.ok) {
      alert(result.message)
    } else {
      alert(result.error)
    }
  }

  if (!user) {
    return <div>로딩중...</div>
  }

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column',
      gap: '10px', alignItems: 'center', justifyContent: 'center',
    }}>
      <h2>출석 체크</h2>
      <p>{user.full_name}({user.student_id}) 님 환영합니다</p>

    <div style={{display: 'flex', padding: '20px', gap:'20px', scale: '2'}}>
      {/* 🔥 ⭐ 버튼 추가 */}
      <button  onClick={handleAttendance}>
        출석하기
      </button>
      <button onClick={() => { localStorage.removeItem('attendance_user'); router.push('/login'); }}>
        로그아웃
      </button>
      </div>
    </div>

  )
}
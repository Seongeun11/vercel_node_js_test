'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginClient() {
  const [full_name, setFullName] = useState('')
  const [student_id, setStudent_id] = useState('')
  const [error_messege, setErrorMessege] = useState('')

  const router = useRouter()
  const searchParams = useSearchParams()

  /**
   * 내부 경로만 허용
   */
  const getSafeRedirectPath = (next) => {
    if (!next) return '/'
    if (!next.startsWith('/')) return '/'
    if (next.startsWith('//')) return '/'
    return next
  }

  const handleLogin = async () => {
    setErrorMessege('')

    if (!full_name.trim() || !student_id.trim()) {
      setErrorMessege('이름과 학번을 모두 입력해주세요.')
      return
    }

    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('full_name', full_name.trim())
      .eq('student_id', student_id.trim())
      .single()

    if (error || !user) {
      setErrorMessege('사용자 정보를 찾을 수 없습니다. 다시 확인해주세요.')
      return
    }

    localStorage.setItem('attendance_user', JSON.stringify(user))

    const next = searchParams.get('next')
    const savedRedirect = sessionStorage.getItem('post_login_redirect')
    const redirectPath = getSafeRedirectPath(next || savedRedirect)

    sessionStorage.removeItem('post_login_redirect')
    router.replace(redirectPath)
  }

  const fullName_handleChange = (e) => {
    const onlyText = e.target.value.replace(/[^ㄱ-ㅎㅏ-ㅣ가-힣a-zA-Z]/g, '')
    setFullName(onlyText)

    if (error_messege) setErrorMessege('')
  }

  const handleChange = (e) => {
    const result = e.target.value.replace(/[^0-9]/g, '')
    setStudent_id(result)

    if (error_messege) setErrorMessege('')
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>출석 로그인</h2>

      <input
        style={{ margin: '10px' }}
        placeholder="이름"
        type="text"
        value={full_name}
        onChange={fullName_handleChange}
      />

      <input
        placeholder="학번"
        type="text"
        value={student_id}
        onChange={handleChange}
      />

      <button
        type="button"
        onClick={handleLogin}
        style={{
          padding: '10px',
          margin: '10px',
          borderRadius: '5px',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        로그인
      </button>

      {error_messege && (
        <p
          style={{
            color: '#ff4d4f',
            fontSize: '13px',
            margin: '0',
            fontWeight: '500',
          }}
        >
          ⚠️ {error_messege}
        </p>
      )}
    </div>
  )
}
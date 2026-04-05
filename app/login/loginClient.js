// app/login/loginClient.js
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginClient() {
  const [student_id, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const searchParams = useSearchParams()

  function getSafeRedirectPath(next) {
    if (!next) return '/'
    if (!next.startsWith('/')) return '/'
    if (next.startsWith('//')) return '/'
    return next
  }

  async function handleLogin() {
    setErrorMessage('')

    const normalizedStudentId = student_id.trim()
    const normalizedPassword = password.trim()

    if (!normalizedStudentId || !normalizedPassword) {
      setErrorMessage('학번과 비밀번호를 모두 입력해주세요.')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          student_id: normalizedStudentId,
          password: normalizedPassword,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result?.user) {
        setErrorMessage(result?.error || '로그인에 실패했습니다.')
        return
      }

      const next = searchParams.get('next')
      const savedRedirect = sessionStorage.getItem('post_login_redirect')
      const redirectPath = getSafeRedirectPath(next || savedRedirect)

      sessionStorage.removeItem('post_login_redirect')

      // 로그인 후에는 서버가 새 쿠키 기준으로 다시 렌더링하게 이동
      router.replace(redirectPath)
      router.refresh()
    } catch (error) {
      console.error('로그인 실패:', error)
      setErrorMessage('로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>출석 로그인</h2>

      <input
        style={{ margin: '10px' }}
        placeholder="학번"
        type="text"
        value={student_id}
        onChange={(e) => {
          setStudentId(e.target.value)
          if (errorMessage) setErrorMessage('')
        }}
        autoComplete="username"
      />

      <input
        placeholder="비밀번호"
        type="password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value)
          if (errorMessage) setErrorMessage('')
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !loading) handleLogin()
        }}
        autoComplete="current-password"
      />

      <button
        type="button"
        onClick={handleLogin}
        disabled={loading}
        style={{
          padding: '10px',
          margin: '10px',
          borderRadius: '5px',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? '로그인 중...' : '로그인'}
      </button>

      {errorMessage && (
        <p
          style={{
            color: '#ff4d4f',
            fontSize: '13px',
            margin: 0,
            fontWeight: '500',
          }}
        >
          ⚠️ {errorMessage}
        </p>
      )}
    </div>
  )
}
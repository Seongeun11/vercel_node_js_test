'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { KeyboardEvent } from 'react'

type LoginResponse = {
  user?: {
    id?: string
    student_id?: string
    role?: string
  }
  error?: string
}

export default function LoginClient() {
  const [studentId, setStudentId] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  const router = useRouter()
  const searchParams = useSearchParams()

  // 오픈 리다이렉트 방지용 안전한 내부 경로만 허용
  function getSafeRedirectPath(next: string | null): string {
    if (!next) return '/'
    if (!next.startsWith('/')) return '/'
    if (next.startsWith('//')) return '/'
    return next
  }

  async function handleLogin(): Promise<void> {
    setErrorMessage('')

    const normalizedStudentId = studentId.trim()
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

      const result: LoginResponse = await response.json()

      if (!response.ok || !result?.user) {
        setErrorMessage(result?.error || '로그인에 실패했습니다.')
        return
      }

      const next = searchParams.get('next')
      const savedRedirect = sessionStorage.getItem('post_login_redirect')
      const redirectPath = getSafeRedirectPath(next || savedRedirect)

      sessionStorage.removeItem('post_login_redirect')

      // 로그인 후 새 쿠키 기준으로 서버 컴포넌트 재평가
      router.replace(redirectPath)
      router.refresh()
    } catch (error: unknown) {
      console.error('로그인 실패:', error)
      setErrorMessage('로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function handlePasswordKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' && !loading) {
      void handleLogin()
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>출석 로그인</h2>

      <input
        style={{ margin: '10px' }}
        placeholder="학번"
        type="text"
        value={studentId}
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
        onKeyDown={handlePasswordKeyDown}
        autoComplete="current-password"
      />

      <button
        type="button"
        onClick={() => void handleLogin()}
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
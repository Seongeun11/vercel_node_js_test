'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getStoredUser } from '@/lib/auth'

type StoredUser = {
  id: string
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
}

/**
 * QR 토큰을 읽어 출석 API를 호출하는 페이지
 */
export default function AttendanceScanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const token = searchParams.get('token')
        const user = getStoredUser() as StoredUser | null

        if (!user) {
          router.replace('/login')
          return
        }

        if (!token) {
          if (!cancelled) {
            setErrorMessage('QR 토큰이 없습니다.')
            setLoading(false)
          }
          return
        }

        const response = await fetch('/api/attendance/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: user.id,
            token,
          }),
        })

        const isJson = response.headers
          .get('content-type')
          ?.includes('application/json')

        const result = isJson
          ? await response.json()
          : { error: '출석 응답 형식이 올바르지 않습니다.' }

        if (cancelled) return

        if (!response.ok) {
          setErrorMessage(result.error || '출석 처리에 실패했습니다.')
          return
        }

        setMessage(result.message || '출석 완료')
      } catch (error) {
        console.error('Attendance scan failed:', error)

        if (!cancelled) {
          setErrorMessage('출석 처리 중 오류가 발생했습니다.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [router, searchParams])

  return (
    <main
      style={{
        padding: '20px',
        maxWidth: '480px',
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      <h2>QR 출석</h2>

      {loading && <p>처리중...</p>}
      {!loading && !!message && <p style={{ color: 'green' }}>✅ {message}</p>}
      {!loading && !!errorMessage && (
        <p style={{ color: 'crimson' }}>⚠️ {errorMessage}</p>
      )}

      <div style={{ marginTop: '20px' }}>
        <button type="button" onClick={() => router.push('/')}>
          메인으로
        </button>
      </div>
    </main>
  )
}
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getStoredUser } from '@/lib/auth'

type StoredUser = {
  id: string
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
}

type ScanStatus = 'idle' | 'loading' | 'success' | 'duplicate' | 'error'

export default function AttendanceScanClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [status, setStatus] = useState<ScanStatus>('loading')

  /**
   * 현재 요청 중인 key
   */
  const inFlightKeyRef = useRef<string | null>(null)

  /**
   * 이미 처리 완료된 key
   */
  const completedKeyRef = useRef<string | null>(null)

  /**
   * 컴포넌트 언마운트 여부
   */
  const unmountedRef = useRef(false)

  const token = useMemo(() => searchParams.get('token'), [searchParams])
  const queryString = useMemo(() => searchParams.toString(), [searchParams])

  useEffect(() => {
    unmountedRef.current = false

    return () => {
      unmountedRef.current = true
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      try {
        const user = getStoredUser() as StoredUser | null
        const currentUrl = queryString ? `${pathname}?${queryString}` : pathname

        if (!user) {
          sessionStorage.setItem('post_login_redirect', currentUrl)
          router.replace(`/login?next=${encodeURIComponent(currentUrl)}`)
          return
        }

        if (!token) {
          if (!unmountedRef.current) {
            setErrorMessage('QR 토큰이 없습니다.')
            setStatus('error')
          }
          return
        }

        const requestKey = `${user.id}:${token}`

        if (completedKeyRef.current === requestKey) {
          return
        }

        if (inFlightKeyRef.current === requestKey) {
          return
        }

        inFlightKeyRef.current = requestKey
        setStatus('loading')
        setMessage('')
        setErrorMessage('')

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

        completedKeyRef.current = requestKey
        inFlightKeyRef.current = null

        if (unmountedRef.current) return

        if (response.status === 409) {
          setErrorMessage(result.error || '이미 출석했습니다.')
          setStatus('duplicate')
          return
        }

        if (!response.ok) {
          setErrorMessage(result.error || '출석 처리에 실패했습니다.')
          setStatus('error')
          return
        }

        setMessage(result.message || '출석 완료')
        setStatus('success')
      } catch (error) {
        console.error('출석체크 실패:', error)

        inFlightKeyRef.current = null

        if (!unmountedRef.current) {
          setErrorMessage('출석 처리 중 오류가 발생했습니다.')
          setStatus('error')
        }
      }
    }

    run()
  }, [pathname, queryString, router, token])

  useEffect(() => {
    if (status !== 'success' && status !== 'duplicate') return

    const timer = window.setTimeout(() => {
      router.replace('/')
    }, 1500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [router, status])

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

      {status === 'loading' && <p>처리중...</p>}

      {status === 'success' && !!message && (
        <p style={{ color: 'green' }}>✅ {message}</p>
      )}

      {status === 'duplicate' && !!errorMessage && (
        <p style={{ color: 'crimson' }}>⚠️ {errorMessage}</p>
      )}

      {status === 'error' && !!errorMessage && (
        <p style={{ color: 'crimson' }}>⚠️ {errorMessage}</p>
      )}

      {status !== 'loading' && (
        <div style={{ marginTop: '20px' }}>
          <button type="button" onClick={() => router.replace('/')}>
            메인으로
          </button>
        </div>
      )}
    </main>
  )
}
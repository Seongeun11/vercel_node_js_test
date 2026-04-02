'use client'
//attendance/scan/page.tsx
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

export default function AttendanceScanPage() {
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

  /**
   * searchParams 전체를 의존성에 넣지 말고
   * 실제 필요한 token 문자열만 고정해서 사용
   */
  const token = useMemo(() => searchParams.get('token'), [searchParams])
  //searchParams.toString()도 한 번만 계산
  const queryString = useMemo(() => searchParams.toString(), [searchParams])

  useEffect(() => {
    unmountedRef.current = false

    return () => {
      unmountedRef.current = true
    }
  }, [])

  useEffect(() => {
   
    //let cancelled = false

    const run = async () => {
      try {
        //const token = searchParams.get('token')
        const user = getStoredUser() as StoredUser | null
        // 현재 URL 보존
        //const currentQuery = searchParams.toString()
        const currentUrl = queryString ? `${pathname}?${queryString}` : pathname

        if (!user) {
          /**
         * 비로그인 상태면 로그인으로 보내고 종료
         * 이 단계에서는 requestedKeyRef를 건드리지 않음
         */
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
        /**
         * 이미 완료된 요청이면 다시 호출하지 않음
         */
        if (completedKeyRef.current === requestKey) {
          if (!unmountedRef.current) {
            
          }
          return
        }  
        /**
         * 같은 요청이 진행 중이면 중복 호출하지 않음
         */
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

        /**
         * 요청 완료 처리
         */
        completedKeyRef.current = requestKey
        inFlightKeyRef.current = null

        if (unmountedRef.current) return

        /**
         * 이미 출석한 경우: 메시지 명확히 표시 + 자동 이동
         */
        if (response.status === 409) {
          setErrorMessage(result.error || '이미 출석했습니다.')
          //1.5초 후 이동
          setTimeout(() => {
            router.replace('/')
          }, 1500)
          setStatus('duplicate')
          return
        }
        
        

        if (!response.ok) {
          /**
           * 409 포함 모든 실패 응답을 화면에 표시
           */
          setErrorMessage(result.error || '출석 처리에 실패했습니다.')
          setStatus('error')
          return
        }

        setMessage(result.message || '출석 완료')
        /**
         * 출석 성공 후에도 자동 이동시키고 싶으면 유지
         */
        setStatus('success')
        } catch (error) {
        console.error('출석체크 실패:', error)
        
        inFlightKeyRef.current = null
        if (!inFlightKeyRef.current) {
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
      {status === 'success' && !!message && <p style={{ color: 'green' }}>✅ {message}</p>}
      {status === 'duplicate' && !!errorMessage && (
        <p style={{ color: 'crimson' }}>⚠️ {errorMessage}</p>
      )}
      {status === 'error' && (
        <p style={{ color: 'crimson' }}>⚠️ {errorMessage}</p>
      )}
      {status !== 'loading' &&(
        <div style={{ marginTop: '20px' }}>
        <button type="button" onClick={() => router.replace('/')}>
          메인으로
        </button>
      </div>
      )}
    </main>
  )
}
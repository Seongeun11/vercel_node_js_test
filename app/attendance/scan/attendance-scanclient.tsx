// app/attendance/scan/page.tsx

'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type CheckResult = {
  success?: boolean
  status?: 'present' | 'late' | 'absent'
  message?: string
  check_time?: string
  check_time_kst?: string
  attendance_date?: string
  attendance_date_kst?: string
  already_checked?: boolean
  error?: string
}

export default function AttendanceScanPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const requestedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<CheckResult | null>(null)

  useEffect(() => {
    const checkAttendance = async () => {
      try {
        if (requestedRef.current) return
        requestedRef.current = true

        if (!token) {
          setResult({ error: 'QR코드를 스캔하세요.' })
          return
        }

        const response = await fetch('/api/attendance/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        /**
         * 비로그인 상태 처리
         * - 현재 QR URL을 next 파라미터로 보존
         * - 로그인 성공 후 다시 QR 출석 페이지로 돌아오기 위함
         */
        // 401만 로그인으로 보낸다.
        // 403은 권한/출석시간 제한 등 여러 의미가 있으므로 JSON 에러를 화면에 표시한다.
        if (response.status === 401) {
          const currentUrl = `${pathname}?${searchParams.toString()}`
          router.replace(`/login?next=${encodeURIComponent(currentUrl)}`)
          return
        }

        const data = response.headers
          .get('content-type')
          ?.includes('application/json')
          ? await response.json()
          : { error: '출석 응답 형식이 올바르지 않습니다.' }

        if (!response.ok) {
          setResult({
            error: data.error || '출석 처리에 실패했습니다.',
          })
          return
        }

      const alreadyChecked = Boolean(data.already_checked)

      setResult({
        success: data.success,
        status: data.status,
        message: alreadyChecked
          ? '이미 출석 처리되었습니다.'
          : data.message || '출석이 완료되었습니다.',
        check_time: data.check_time,
        check_time_kst: data.check_time_kst ?? data.recorded_at_kst,
        attendance_date: data.attendance_date,
        attendance_date_kst: data.attendance_date_kst ?? data.attendance_date,
        already_checked: alreadyChecked,
      })
      } catch (error) {
        console.error(error)
        setResult({
          error: '출석 처리 중 오류가 발생했습니다.',
        })
      } finally {
        setLoading(false)
      }
    }

    void checkAttendance()
  }, [token, pathname, searchParams, router])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f7f7f7',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#fff',
          border: '1px solid #e5e5e5',
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <h2 style={{ marginTop: 0 }}>QR 출석 처리</h2>

        {loading ? (
          <p>출석을 처리하는 중입니다...</p>
        ) : result?.error ? (
          <>
            <p style={{ color: 'crimson', fontWeight: 700 }}>
              ⚠️ {result.error}
            </p>

            <div
              style={{
                marginTop: '16px',
                display: 'flex',
                gap: '8px',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button type="button" onClick={() => router.push('/')}>
                메인으로
              </button>
            </div>
          </>
        ) : (
          <>
            <p
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: result?.status === 'late' ? '#b45309' : 'green',
              }}
            >
              {result?.already_checked ? 'ℹ️ ' : '✅ '}
              {result?.message || '출석이 완료되었습니다.'}
            </p>

            <div
              style={{
                marginTop: '16px',
                textAlign: 'left',
                border: '1px solid #eee',
                borderRadius: '12px',
                padding: '16px',
                background: '#fafafa',
              }}
            >
              <div style={{ marginBottom: '8px' }}>
                <strong>출석 상태:</strong>{' '}
                {result?.status === 'present'
                  ? '출석'
                  : result?.status === 'late'
                    ? '지각'
                    : result?.status === 'absent'
                      ? '결석'
                      : '-'}
              </div>

              <div style={{ marginBottom: '8px' }}>
                <strong>출석 날짜(KST):</strong>{' '}
                {result?.attendance_date_kst || '-'}
              </div>

              <div>
                <strong>처리 시각(KST):</strong>{' '}
                {result?.check_time_kst || '-'}
              </div>
            </div>

            <div
              style={{
                marginTop: '16px',
                display: 'flex',
                gap: '8px',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button type="button" onClick={() => router.push('/')}>
                메인으로
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import AttendanceChangeRequestButton from '@/components/attendance/attendanceChangeRequestButton'

type AttendanceStatus = 'present' | 'late' | 'absent'
type AttendanceMethod = 'manual' | 'qr' | 'nfc'

type AttendanceItem = {
  id: string
  user_id: string
  event_id: string
  attendance_date: string
  status: AttendanceStatus
  method: AttendanceMethod
  check_time: string
  created_at: string
  updated_at: string
  can_request_change: boolean
  pending_request_exists: boolean
  event: {
    id: string
    name: string
    start_time: string
    late_threshold_min: number
  } | null
}

type AttendanceListResponse = {
  items?: AttendanceItem[]
  error?: string
}

// 최적화: Intl 인스턴스를 외부에 단 한 번만 생성하여 렌더링 성능을 올립니다.
const kstFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

function formatDateTimeKst(value: string | null): string {
  if (!value) return '-'

  try {
    return kstFormatter.format(new Date(value))
  } catch {
    return value
  }
}

function getStatusLabel(status: AttendanceStatus) {
  switch (status) {
    case 'present':
      return '출석'
    case 'late':
      return '지각'
    case 'absent':
      return '결석'
    default:
      return status
  }
}

function getMethodLabel(method: AttendanceMethod) {
  switch (method) {
    case 'manual':
      return '수동'
    case 'qr':
      return 'QR'
    case 'nfc':
      return 'NFC'
    default:
      return method
  }
}

export default function MyAttendanceClient() {
  const [items, setItems] = useState<AttendanceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // 최적화: useCallback으로 감싸 무한 루프 및 불필요한 함수 재생성을 방지합니다.
  const fetchAttendance = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      setErrorMessage('')

      // 최근 10개만 요청하도록 limit=10 쿼리 파라미터 추가
      const response = await fetch('/api/attendance/list?limit=10', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })

      console.log('API 응답 상태 코드:', response.status)
      
      if (response.status === 401) {
        console.error('인증 실패: 세션이 만료되었거나 로그인이 필요합니다.')
        alert('세션이 만료되었습니다. 다시 로그인해주세요.')
        window.location.href = '/login'
        return
      }

      if (response.status === 403) {
        window.location.href = '/forbidden'
        return
      }

      const text = await response.text()
      const result: AttendanceListResponse = text ? JSON.parse(text) : {}

      if (!response.ok) {
        setItems([])
        setErrorMessage(result.error || '내 출석 목록을 불러오지 못했습니다.')
        return
      }

      setItems(result.items ?? [])
    } catch {
      setItems([])
      setErrorMessage('내 출석 목록 조회 중 오류가 발생했습니다.')
    } finally {
      if (isInitial) {
        setLoading(false)
      } else {
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    void fetchAttendance(true)
  }, [fetchAttendance])

  if (loading) {
    return <div style={{ padding: '20px' }}>내 출석 목록을 불러오는 중입니다...</div>
  }

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>내 출석 조회 (최근 10건)</h1>
          <p style={{ marginTop: '8px', color: '#002fff' }}>
            본인의 최근 출석 기록 10건을 확인합니다.<br></br> 지각 정정요청은 아카데미 팀에게 문의하세요.
          </p>
          
          <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap' }}>
            <Link href="/">
              <button type="button">메인으로</button>
            </Link>
            {/*
            <Link href="/attendance/requests">
              <button type="button">내 변경 요청 보기</button>
            </Link>
            */}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void fetchAttendance(false)}
            disabled={refreshing}
          >
            {refreshing ? '새로고침 중...' : '새로고침'}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px',
            borderRadius: '8px',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#be123c',
          }}
        >
          {errorMessage}
        </div>
      )}

      {items.length === 0 ? (
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '12px',
            background: '#fff',
            padding: '20px',
          }}
        >
          조회된 출석 기록이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '12px',
                background: '#fff',
                padding: '16px',
              }}
            >
              <div style={{ display: 'grid', gap: '8px' }}>
                <div>
                  <strong>행사:</strong> {item.event?.name || '-'}
                </div>
                <div>
                  <strong>날짜:</strong> {item.attendance_date}
                </div>
                <div>
                  <strong>출석 상태:</strong> {getStatusLabel(item.status)}
                </div>
                <div>
                  <strong>출석 방식:</strong> {getMethodLabel(item.method)}
                </div>
                <div>
                  <strong>처리 시각:</strong> {formatDateTimeKst(item.check_time)}
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                {item.pending_request_exists ? (
                  <div
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#1d4ed8',
                    }}
                  >
                    현재 이 출석 건에 대해 처리 대기 중인 변경 요청이 있습니다.
                  </div>
                ) : item.can_request_change ? (
                  <AttendanceChangeRequestButton
                    attendanceId={item.id}
                    currentStatus={item.status}
                    onSuccess={() => {
                      void fetchAttendance(false)
                    }}
                  />
                ) : null }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
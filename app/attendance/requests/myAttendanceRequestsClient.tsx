// app/attendance/requests/MyAttendanceRequestsClient.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
type AttendanceStatus = 'present' | 'late' | 'absent'

type MyRequestItem = {
  id: number
  attendance_id: string
  requested_status: AttendanceStatus
  reason: string
  status: RequestStatus
  review_comment: string | null
  reviewed_at: string | null
  created_at: string
}

type MyRequestsResponse = {
  items?: MyRequestItem[]
  error?: string
}

function formatDateTimeKst(value: string | null): string {
  if (!value) return '-'

  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(value))
  } catch {
    return value
  }
}

function getStatusLabel(status: RequestStatus) {
  switch (status) {
    case 'pending':
      return '대기중'
    case 'approved':
      return '승인됨'
    case 'rejected':
      return '반려됨'
    case 'cancelled':
      return '취소됨'
    default:
      return status
  }
}

function getAttendanceStatusLabel(status: AttendanceStatus) {
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

export default function MyAttendanceRequestsClient() {
  const [items, setItems] = useState<MyRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  async function fetchMyRequests() {
    try {
      setLoading(true)
      setErrorMessage('')

      const response = await fetch('/api/attendance-change-requests/my', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })

      if (response.status === 401) {
        window.location.href = '/login'
        return
      }

      if (response.status === 403) {
        window.location.href = '/forbidden'
        return
      }

      const text = await response.text()
      const result: MyRequestsResponse = text ? JSON.parse(text) : {}

      if (!response.ok) {
        setItems([])
        setErrorMessage(result.error || '내 요청 목록을 불러오지 못했습니다.')
        return
      }

      setItems(result.items ?? [])
    } catch {
      setItems([])
      setErrorMessage('내 요청 목록 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchMyRequests()
  }, [])

  if (loading) {
    return <div style={{ padding: '20px' }}> 목록을 불러오는 중입니다...</div>
  }

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      
      <h1 style={{ marginTop: 0 }}>내 출석 변경 요청</h1>
      <p style={{ color: '#555', marginBottom: '20px' }}>
        내가 요청한 출석 변경 내역과 처리 상태를 확인할 수 있습니다.
        
      </p>
      <Link href="/">
            <button type="button">메인으로</button>
          </Link>

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
          요청 내역이 없습니다.
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
                  <strong>요청 ID:</strong> {item.id}
                </div>
                <div>
                  <strong>변경 요청 상태:</strong>{' '}
                  {getAttendanceStatusLabel(item.requested_status)}
                </div>
                <div>
                  <strong>처리 상태:</strong> {getStatusLabel(item.status)}
                </div>
                <div>
                  <strong>요청 사유:</strong>
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '10px',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {item.reason}
                  </div>
                </div>
                <div>
                  <strong>반려/검토 메모:</strong>{' '}
                  {item.review_comment?.trim() ? item.review_comment : '-'}
                </div>
                <div>
                  <strong>요청 시각:</strong> {formatDateTimeKst(item.created_at)}
                </div>
                <div>
                  <strong>처리 시각:</strong> {formatDateTimeKst(item.reviewed_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
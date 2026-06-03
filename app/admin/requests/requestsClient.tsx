// app/admin/requests/RequestsClient.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminHeader from '@/components/admin/AdminHeader'

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
type AttendanceStatus = 'present' | 'late' | 'absent'

type RequestQueueItem = {
  request_id: number
  user_id: string
  student_id: string
  full_name: string
  event_id: string
  event_name: string
  requested_status: AttendanceStatus
  reason: string
  status: RequestStatus
  created_at: string
}

type QueueResponse = {
  items?: RequestQueueItem[]
  error?: string
  detail?: string
}

type ActionResponse = {
  message?: string
  error?: string
  detail?: string
}

function formatDateTimeKst(value: string): string {
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

const statusLabelMap: Record<AttendanceStatus, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
}

export default function RequestsClient() {
  const [items, setItems] = useState<RequestQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [errorMessage, setErrorMessage] = useState('')
  const [message, setMessage] = useState('')

  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [reviewComment, setReviewComment] = useState('')

  const selectedItem = useMemo(
    () => items.find((item) => item.request_id === selectedRequestId) ?? null,
    [items, selectedRequestId]
  )

  async function fetchQueue(isInitial = false) {
    try {
      if (isInitial) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      setErrorMessage('')

      const response = await fetch('/api/attendance-change-requests/queue', {
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
      const result: QueueResponse = text ? JSON.parse(text) : {}

      if (!response.ok) {
        setItems([])
        setErrorMessage(result.error || '변경 요청 큐를 불러오지 못했습니다.')
        return
      }

      const fetchedItems = result.items ?? []
      setItems(fetchedItems)

      if (fetchedItems.length === 0) {
        setSelectedRequestId(null)
        return
      }

      const stillExists = fetchedItems.some(
        (item) => item.request_id === selectedRequestId
      )

      if (!stillExists) {
        setSelectedRequestId(fetchedItems[0].request_id)
      }
    } catch (error) {
      console.error('[admin/requests] queue fetch error:', error)
      setItems([])
      setErrorMessage('변경 요청 큐 조회 중 오류가 발생했습니다.')
    } finally {
      if (isInitial) setLoading(false)
      else setRefreshing(false)
    }
  }

  useEffect(() => {
    void fetchQueue(true)
  }, [])

  async function handleApprove() {
    if (!selectedItem) {
      setErrorMessage('처리할 요청을 선택해주세요.')
      return
    }

    try {
      setSubmitting(true)
      setErrorMessage('')
      setMessage('')

      const response = await fetch('/api/attendance-change-requests/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          request_id: selectedItem.request_id,
          review_comment: reviewComment.trim() || null,
        }),
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
      const result: ActionResponse = text ? JSON.parse(text) : {}

      if (!response.ok) {
        setErrorMessage(result.error || '요청 승인에 실패했습니다.')
        return
      }

      setMessage(result.message || '변경 요청이 승인되었습니다.')
      setReviewComment('')
      await fetchQueue(false)
    } catch (error) {
      console.error('[admin/requests] approve error:', error)
      setErrorMessage('요청 승인 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReject() {
    if (!selectedItem) {
      setErrorMessage('처리할 요청을 선택해주세요.')
      return
    }

    if (!reviewComment.trim()) {
      setErrorMessage('반려 사유를 입력해주세요.')
      return
    }

    try {
      setSubmitting(true)
      setErrorMessage('')
      setMessage('')

      const response = await fetch('/api/attendance-change-requests/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          request_id: selectedItem.request_id,
          review_comment: reviewComment.trim(),
        }),
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
      const result: ActionResponse = text ? JSON.parse(text) : {}

      if (!response.ok) {
        setErrorMessage(result.error || '요청 반려에 실패했습니다.')
        return
      }

      setMessage(result.message || '변경 요청이 반려되었습니다.')
      setReviewComment('')
      await fetchQueue(false)
    } catch (error) {
      console.error('[admin/requests] reject error:', error)
      setErrorMessage('요청 반려 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>변경 요청 큐를 불러오는 중입니다...</div>
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <AdminHeader
        title="출석 변경 요청 처리"
        description="캡틴과 관리자는 처리 대기 중인 출석 변경 요청을 검토할 수 있습니다."
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>출석 변경 요청 처리</h1>
          <p style={{ marginTop: '8px', color: '#555' }}>
            현재 처리 대기 중인 요청만 표시됩니다.
          </p>
        </div>

        <button type="button" onClick={() => void fetchQueue(false)} disabled={refreshing}>
          {refreshing ? '새로고침 중...' : '새로고침'}
        </button>
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

      {message && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px',
            borderRadius: '8px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#166534',
          }}
        >
          {message}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(360px, 1fr) minmax(360px, 1fr)',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '12px',
            background: '#fff',
            padding: '16px',
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: '18px' }}>처리 대기 요청</h2>

          {items.length === 0 ? (
            <div>현재 처리 대기 중인 요청이 없습니다.</div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {items.map((item) => {
                const isSelected = item.request_id === selectedRequestId

                return (
                  <button
                    key={item.request_id}
                    type="button"
                    onClick={() => setSelectedRequestId(item.request_id)}
                    style={{
                      textAlign: 'left',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #ddd',
                      borderRadius: '10px',
                      padding: '12px',
                      background: isSelected ? '#eff6ff' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {item.full_name} ({item.student_id})
                    </div>

                    <div style={{ marginTop: '6px', color: '#555' }}>
                      {item.event_name}
                    </div>

                    <div style={{ marginTop: '6px', color: '#666', fontSize: '14px' }}>
                      요청 상태: {statusLabelMap[item.requested_status]}
                    </div>

                    <div style={{ marginTop: '4px', color: '#666', fontSize: '13px' }}>
                      요청 시각: {formatDateTimeKst(item.created_at)}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '12px',
            background: '#fff',
            padding: '16px',
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: '18px' }}>요청 상세</h2>

          {!selectedItem ? (
            <div>처리할 요청을 선택해주세요.</div>
          ) : (
            <>
              <div style={{ marginBottom: '16px', color: '#555', display: 'grid', gap: '8px' }}>
                <div>
                  <strong>요청자:</strong> {selectedItem.full_name} ({selectedItem.student_id})
                </div>
                <div>
                  <strong>행사:</strong> {selectedItem.event_name}
                </div>
                <div>
                  <strong>변경 요청 상태:</strong> {statusLabelMap[selectedItem.requested_status]}
                </div>
                <div>
                  <strong>요청 시각:</strong> {formatDateTimeKst(selectedItem.created_at)}
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
                    {selectedItem.reason}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px' }}>
                    검토 메모
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={4}
                    placeholder="승인 메모 또는 반려 사유를 입력하세요."
                    style={{
                      width: '100%',
                      padding: '10px',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={submitting}
                  >
                    {submitting ? '처리 중...' : '승인'}
                  </button>

                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={submitting}
                  >
                    {submitting ? '처리 중...' : '반려'}
                  </button>
                </div>

                <div style={{ color: '#666', fontSize: '13px' }}>
                  반려 시에는 반려 사유 입력이 필요합니다.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
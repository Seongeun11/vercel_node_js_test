// components/attendance/attendanceChangeRequestButton.tsx
'use client'

import { useState } from 'react'

type AttendanceStatus = 'present' | 'late' | 'absent'

type Props = {
  attendanceId: string
  currentStatus: AttendanceStatus
  onSuccess?: () => void
}

type CreateResponse = {
  message?: string
  request_id?: number
  error?: string
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

const REQUESTABLE_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent']

export default function AttendanceChangeRequestButton({
  attendanceId,
  currentStatus,
  onSuccess,
}: Props) {
  const [open, setOpen] = useState(false)
  const [requestedStatus, setRequestedStatus] =
    useState<AttendanceStatus>('present')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit() {
    if (!reason.trim()) {
      setErrorMessage('변경 사유를 입력해주세요.')
      return
    }

    try {
      setLoading(true)
      setErrorMessage('')
      setMessage('')

      const response = await fetch('/api/attendance-change-requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          attendance_id: attendanceId,
          requested_status: requestedStatus,
          reason: reason.trim(),
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
      const result: CreateResponse = text ? JSON.parse(text) : {}

      if (!response.ok) {
        setErrorMessage(result.error || '출석 변경 요청 생성에 실패했습니다.')
        return
      }

      setMessage(result.message || '출석 변경 요청이 접수되었습니다.')
      setReason('')
      setOpen(false)
      onSuccess?.()
    } catch {
      setErrorMessage('출석 변경 요청 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: '10px' }}>
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev)
          setErrorMessage('')
          setMessage('')
        }}
      >
        출석 변경 요청
      </button>

      {message && (
        <div
          style={{
            marginTop: '10px',
            padding: '10px',
            borderRadius: '8px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#166534',
          }}
        >
          {message}
        </div>
      )}

      {open && (
        <div
          style={{
            marginTop: '12px',
            padding: '14px',
            border: '1px solid #ddd',
            borderRadius: '10px',
            background: '#fff',
            display: 'grid',
            gap: '10px',
          }}
        >
          <div>
            <strong>현재 상태:</strong> {getStatusLabel(currentStatus)}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>
              변경 요청 상태
            </label>
            <select
              value={requestedStatus}
              onChange={(e) =>
                setRequestedStatus(e.target.value as AttendanceStatus)
              }
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            >
              {REQUESTABLE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>
              변경 사유
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="예: QR 인식 오류로 실제보다 지각 처리되었습니다."
              style={{
                width: '100%',
                padding: '10px',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>

          {errorMessage && (
            <div
              style={{
                padding: '10px',
                borderRadius: '8px',
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#be123c',
              }}
            >
              {errorMessage}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? '요청 중...' : '요청 제출'}
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
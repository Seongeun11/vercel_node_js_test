// app/admin/attendance/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminHeader from '@/components/admin/AdminHeader'

type AttendanceStatus = 'present' | 'late' | 'absent'
type AttendanceMethod = 'manual'

type AttendanceManageItem = {
  id: string
  user_id: string
  event_id: string
  date: string
  status: AttendanceStatus
  method: AttendanceMethod
  check_time: string
  created_at: string
  updated_at: string
  event: {
    id: string
    name: string
    start_time: string
    late_threshold_min: number
  } | null
  user: {
    id: string
    student_id: string
    full_name: string
    role: 'admin' | 'captain' | 'trainee'
  } | null
}

type AttendanceManageListResponse = {
  items?: AttendanceManageItem[]
  error?: string
}

type EditAttendanceResponse = {
  message?: string
  item?: AttendanceManageItem
  error?: string
}

const STATUS_OPTIONS: AttendanceStatus[] = ['present', 'late', 'absent']
const METHOD_OPTIONS: AttendanceMethod[] = ['manual']

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

function toLocalDateTimeInputValue(value: string): string {
  try {
    const date = new Date(value)
    const kstMs = date.getTime() + 9 * 60 * 60 * 1000
    return new Date(kstMs).toISOString().slice(0, 16)
  } catch {
    return ''
  }
}

export default function AdminAttendancePage() {
  const [items, setItems] = useState<AttendanceManageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)

  const [errorMessage, setErrorMessage] = useState('')
  const [message, setMessage] = useState('')

  const [userKeyword, setUserKeyword] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [selectedId, setSelectedId] = useState('')
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  )

  const [status, setStatus] = useState<AttendanceStatus>('present')
  const [method, setMethod] = useState<AttendanceMethod>('manual')
  const [checkTime, setCheckTime] = useState('')
  const [reason, setReason] = useState('')

  async function fetchAttendance(isInitial = false) {
    try {
      if (isInitial) {
        setLoading(true)
      } else {
        setSearchLoading(true)
      }

      setErrorMessage('')

      const params = new URLSearchParams()
      if (userKeyword.trim()) params.set('user_keyword', userKeyword.trim())
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)

      const response = await fetch(
        `/api/attendance/manage/list${params.toString() ? `?${params.toString()}` : ''}`,
        {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        }
      )

      const text = await response.text()
      const result: AttendanceManageListResponse = text ? JSON.parse(text) : {}

      if (!response.ok) {
        setItems([])
        setErrorMessage(result.error || '출석 목록을 불러오지 못했습니다.')
        return
      }

      const fetchedItems = result.items ?? []
      setItems(fetchedItems)

      if (fetchedItems.length > 0) {
        const first = fetchedItems[0]
        setSelectedId(first.id)
        setStatus(first.status)
        setMethod(first.method)
        setCheckTime(toLocalDateTimeInputValue(first.check_time))
      } else {
        setSelectedId('')
      }
    } catch (error) {
      console.error('[admin/attendance] fetch error:', error)
      setItems([])
      setErrorMessage('출석 목록 조회 중 오류가 발생했습니다.')
    } finally {
      if (isInitial) {
        setLoading(false)
      } else {
        setSearchLoading(false)
      }
    }
  }

  useEffect(() => {
    void fetchAttendance(true)
  }, [])

  useEffect(() => {
    if (!selectedItem) return
    setStatus(selectedItem.status)
    setMethod(selectedItem.method)
    setCheckTime(toLocalDateTimeInputValue(selectedItem.check_time))
  }, [selectedItem])

  async function handleEditAttendance() {
    if (!selectedItem) {
      setErrorMessage('수정할 출석 기록을 선택해주세요.')
      return
    }

    if (!reason.trim()) {
      setErrorMessage('수정 사유를 입력해주세요.')
      return
    }

    try {
      setSubmitLoading(true)
      setErrorMessage('')
      setMessage('')

      const payload = {
        attendance_id: selectedItem.id,
        status,
        method,
        check_time: checkTime ? new Date(checkTime).toISOString() : null,
        reason: reason.trim(),
      }

      const response = await fetch('/api/attendance/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const text = await response.text()
      const result: EditAttendanceResponse = text ? JSON.parse(text) : {}

      if (!response.ok) {
        setErrorMessage(result.error || '출석 수정에 실패했습니다.')
        return
      }

      setMessage(result.message || '출석 정보가 수정되었습니다.')
      setReason('')
      await fetchAttendance(false)
    } catch (error) {
      console.error('[admin/attendance] edit error:', error)
      setErrorMessage('출석 수정 중 오류가 발생했습니다.')
    } finally {
      setSubmitLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>출석 수정 화면을 불러오는 중입니다...</div>
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <AdminHeader
        title="출석 수정"
        description="캡틴/관리자가 출석 기록을 조회하고 수정할 수 있습니다."
      />
      
      <h1 style={{ marginTop: 0 }}>출석 수정</h1>
      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '12px',
          background: '#fff',
          padding: '16px',
          marginBottom: '20px',
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: '18px' }}>조회 조건</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>
              이름/학번
            </label>
            <input
              value={userKeyword}
              onChange={(e) => setUserKeyword(e.target.value)}
              placeholder="홍길동 또는 20260001"
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>날짜 시작</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>날짜 끝</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void fetchAttendance(false)} disabled={searchLoading}>
            {searchLoading ? '조회 중...' : '조회'}
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
          <h2 style={{ marginTop: 0, fontSize: '18px' }}>출석 기록 목록</h2>

          {items.length === 0 ? (
            <div>조회된 출석 기록이 없습니다.</div>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {items.map((item) => {
                const isSelected = item.id === selectedId

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
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
                      {item.user?.full_name || '-'} ({item.user?.student_id || '-'})
                    </div>
                    <div style={{ marginTop: '6px', color: '#555' }}>
                      {item.event?.name || '-'} / {item.date}
                    </div>
                    <div style={{ marginTop: '6px', color: '#666', fontSize: '14px' }}>
                      상태: {item.status} / 방식: {item.method}
                    </div>
                    <div style={{ marginTop: '4px', color: '#666', fontSize: '13px' }}>
                      처리 시각: {formatDateTimeKst(item.check_time)}
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
          <h2 style={{ marginTop: 0, fontSize: '18px' }}>출석 수정</h2>

          {!selectedItem ? (
            <div>수정할 출석 기록을 선택해주세요.</div>
          ) : (
            <>
              <div style={{ marginBottom: '12px', color: '#555' }}>
                <div><strong>대상:</strong> {selectedItem.user?.full_name || '-'} ({selectedItem.user?.student_id || '-'})</div>
                <div><strong>행사:</strong> {selectedItem.event?.name || '-'}</div>
                <div><strong>현재 상태:</strong> {selectedItem.status}</div>
                <div><strong>현재 방식:</strong> {selectedItem.method}</div>
              </div>

              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px' }}>상태</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
                    style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
                  >
                    {STATUS_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px' }}>방식</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as AttendanceMethod)}
                    style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
                  >
                    {METHOD_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px' }}>
                    처리 시각
                  </label>
                  <input
                    type="datetime-local"
                    value={checkTime}
                    onChange={(e) => setCheckTime(e.target.value)}
                    style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px' }}>
                    수정 사유
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    placeholder="예: 출석 누락 보정, 오출석 수정, 시스템 오류 정정"
                    style={{
                      width: '100%',
                      padding: '10px',
                      boxSizing: 'border-box',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <button type="button" onClick={handleEditAttendance} disabled={submitLoading}>
                  {submitLoading ? '수정 중...' : '출석 수정 저장'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
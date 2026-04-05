'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type EventItem = {
  id: string
  name: string
  start_time: string
  late_threshold_min: number
}

type AttendanceItem = {
  id: string
  user_id: string
  event_id: string
  date: string
  status: 'present' | 'late' | 'absent'
  method: 'manual' | 'qr' | 'nfc'
  check_time: string
  user?: {
    id: string
    full_name: string
    student_id: string
    role: 'admin' | 'captain' | 'trainee'
  } | null
  event?: {
    id: string
    name: string
  } | null
}

type AttendanceDetail = {
  id: string
  user_id: string
  event_id: string
  date: string
  status: 'present' | 'late' | 'absent'
  method: 'manual' | 'qr' | 'nfc'
  check_time: string
} | null

const STATUS_OPTIONS = [
  { value: 'present', label: '출석' },
  { value: 'late', label: '지각' },
  { value: 'absent', label: '결석' },
] as const

export default function AdminAttendancePage() {
  const router = useRouter()

  const [events, setEvents] = useState<EventItem[]>([])
  const [attendanceList, setAttendanceList] = useState<AttendanceItem[]>([])

  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  })

  const [loading, setLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)

  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const [editTarget, setEditTarget] = useState<{
    target_user_id: string
    event_id: string
    date: string
    full_name: string
    student_id: string
  } | null>(null)

  const [editStatus, setEditStatus] = useState<'present' | 'late' | 'absent'>('present')
  const [editMethod, setEditMethod] = useState<'manual' | 'qr' | 'nfc'>('manual')
  const [detailLoading, setDetailLoading] = useState(false)

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId]
  )

  const formatDateTime = (value: string) => {
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

  const fetchEvents = async () => {
    const response = await fetch('/api/events/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const result = response.headers
      .get('content-type')
      ?.includes('application/json')
      ? await response.json()
      : { error: '이벤트 목록 응답 형식이 올바르지 않습니다.' }

    if (!response.ok) {
      throw new Error(result.error || '이벤트 목록을 불러오지 못했습니다.')
    }

    const fetchedEvents = result.events ?? []
    setEvents(fetchedEvents)

    if (!selectedEventId && fetchedEvents.length > 0) {
      setSelectedEventId(fetchedEvents[0].id)
    }

    return fetchedEvents as EventItem[]
  }

  const fetchAttendance = async (eventId: string, date: string) => {
    if (!eventId || !date) {
      setAttendanceList([])
      return
    }

    const response = await fetch('/api/attendance/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        date,
      }),
    })

    const result = response.headers
      .get('content-type')
      ?.includes('application/json')
      ? await response.json()
      : { error: '출석 목록 응답 형식이 올바르지 않습니다.' }

    if (!response.ok) {
      throw new Error(result.error || '출석 목록을 불러오지 못했습니다.')
    }

    setAttendanceList(result.attendance ?? [])
  }

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true)
        setErrorMessage('')
        const fetchedEvents = await fetchEvents()

        const eventId = selectedEventId || fetchedEvents[0]?.id || ''
        if (eventId) {
          await fetchAttendance(eventId, selectedDate)
        }
      } catch (error) {
        console.error(error)
        setErrorMessage(
          error instanceof Error ? error.message : '초기 데이터 로딩 중 오류가 발생했습니다.'
        )
      } finally {
        setLoading(false)
      }
    }

    void init()
  }, [])

  useEffect(() => {
    if (!selectedEventId || !selectedDate) return

    const run = async () => {
      try {
        setLoading(true)
        setErrorMessage('')
        await fetchAttendance(selectedEventId, selectedDate)
      } catch (error) {
        console.error(error)
        setErrorMessage(
          error instanceof Error ? error.message : '출석 목록 조회 중 오류가 발생했습니다.'
        )
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [selectedEventId, selectedDate])

  const handleOpenEdit = async (item: AttendanceItem) => {
    try {
      setDetailLoading(true)
      setMessage('')
      setErrorMessage('')

      const response = await fetch('/api/attendance/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: item.user_id,
          event_id: item.event_id,
          date: item.date,
        }),
      })

      const result = response.headers
        .get('content-type')
        ?.includes('application/json')
        ? await response.json()
        : { error: '출석 상세 응답 형식이 올바르지 않습니다.' }

      if (!response.ok) {
        setErrorMessage(result.error || '출석 상세를 불러오지 못했습니다.')
        return
      }

      const attendance = result.attendance as AttendanceDetail

      setEditTarget({
        target_user_id: item.user_id,
        event_id: item.event_id,
        date: item.date,
        full_name: item.user?.full_name || '이름 없음',
        student_id: item.user?.student_id || '-',
      })

      setEditStatus(attendance?.status ?? item.status)
      setEditMethod(attendance?.method ?? item.method)
    } catch (error) {
      console.error(error)
      setErrorMessage('출석 상세 조회 중 오류가 발생했습니다.')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editTarget) return

    try {
      setSubmitLoading(true)
      setMessage('')
      setErrorMessage('')

      const response = await fetch('/api/attendance/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: editTarget.target_user_id,
          event_id: editTarget.event_id,
          date: editTarget.date,
          status: editStatus,
          method: editMethod,
        }),
      })

      const result = response.headers
        .get('content-type')
        ?.includes('application/json')
        ? await response.json()
        : { error: '출석 수정 응답 형식이 올바르지 않습니다.' }

      if (!response.ok) {
        setErrorMessage(result.error || '출석 수정에 실패했습니다.')
        return
      }

      setMessage(result.message || '출석 기록이 수정되었습니다.')
      setEditTarget(null)

      if (selectedEventId && selectedDate) {
        await fetchAttendance(selectedEventId, selectedDate)
      }
    } catch (error) {
      console.error(error)
      setErrorMessage('출석 수정 중 오류가 발생했습니다.')
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1100px', margin: '0 auto' }}>
      <h2>출석 현황</h2>

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '12px',
          padding: '20px',
          background: '#fff',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 220px auto',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>이벤트 선택</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>날짜</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => router.push('/admin')}>
              관리자 페이지로
            </button>
          </div>
        </div>

        {selectedEvent && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              border: '1px solid #eee',
              borderRadius: '8px',
            }}
          >
            <div>
              <strong>선택 이벤트:</strong> {selectedEvent.name}
            </div>
            <div>
              <strong>시작 시간:</strong> {formatDateTime(selectedEvent.start_time)}
            </div>
            <div>
              <strong>지각 기준:</strong> {selectedEvent.late_threshold_min}분
            </div>
          </div>
        )}

        {message && <p style={{ color: 'green', marginTop: '16px' }}>✅ {message}</p>}
        {errorMessage && (
          <p style={{ color: 'crimson', marginTop: '16px' }}>⚠️ {errorMessage}</p>
        )}
      </div>

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '12px',
          padding: '20px',
          background: '#fff',
        }}
      >
        <h3 style={{ marginTop: 0 }}>출석 목록</h3>

        {loading ? (
          <p>로딩중...</p>
        ) : attendanceList.length === 0 ? (
          <p>조회된 출석 기록이 없습니다.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>이름</th>
                  <th style={thStyle}>학번</th>
                  <th style={thStyle}>상태</th>
                  <th style={thStyle}>방식</th>
                  <th style={thStyle}>체크 시간</th>
                  <th style={thStyle}>관리</th>
                </tr>
              </thead>
              <tbody>
                {attendanceList.map((item) => (
                  <tr key={item.id}>
                    <td style={tdStyle}>{item.user?.full_name || '-'}</td>
                    <td style={tdStyle}>{item.user?.student_id || '-'}</td>
                    <td style={tdStyle}>{statusLabel(item.status)}</td>
                    <td style={tdStyle}>{item.method}</td>
                    <td style={tdStyle}>{formatDateTime(item.check_time)}</td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => void handleOpenEdit(item)}
                        disabled={detailLoading}
                      >
                        {detailLoading ? '불러오는 중...' : '수정'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <h3 style={{ marginTop: 0 }}>출석 수정</h3>

            <p style={{ marginTop: 0 }}>
              {editTarget.full_name} ({editTarget.student_id})
            </p>
            <p>{editTarget.date}</p>

            <label style={{ display: 'block', marginBottom: '6px' }}>상태</label>
            <select
              value={editStatus}
              onChange={(e) =>
                setEditStatus(e.target.value as 'present' | 'late' | 'absent')
              }
              style={{ width: '100%', padding: '10px', marginBottom: '12px' }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label style={{ display: 'block', marginBottom: '6px' }}>방식</label>
            <select
              value={editMethod}
              onChange={(e) =>
                setEditMethod(e.target.value as 'manual' | 'qr' | 'nfc')
              }
              style={{ width: '100%', padding: '10px', marginBottom: '16px' }}
            >
              <option value="manual">manual</option>
              <option value="qr">qr</option>
              <option value="nfc">nfc</option>
            </select>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleSaveEdit} disabled={submitLoading}>
                {submitLoading ? '저장중...' : '저장'}
              </button>
              <button type="button" onClick={() => setEditTarget(null)}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function statusLabel(status: AttendanceItem['status']) {
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

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  borderBottom: '1px solid #ddd',
  padding: '10px',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  borderBottom: '1px solid #eee',
  padding: '10px',
  verticalAlign: 'top',
}
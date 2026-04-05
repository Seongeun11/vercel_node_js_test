'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type EventItem = {
  id: string
  name: string
  start_time: string
  late_threshold_min: number
}

type LogUser = {
  id: string
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
}

type LogEvent = {
  id: string
  name: string
  start_time: string | null
}

type AttendanceSnapshot = {
  user_id?: string
  event_id?: string
  date?: string
  status?: 'present' | 'late' | 'absent'
  method?: 'manual' | 'qr' | 'nfc'
  check_time?: string
} | null

type AttendanceLogItem = {
  id: string
  attendance_id: string | null
  changed_at: string
  changed_by: LogUser | null
  target_user: LogUser | null
  event: LogEvent | null
  before_value: AttendanceSnapshot
  after_value: AttendanceSnapshot
  date: string | null
}

export default function LogsPage() {
  const router = useRouter()

  const [events, setEvents] = useState<EventItem[]>([])
  const [logs, setLogs] = useState<AttendanceLogItem[]>([])

  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [limit, setLimit] = useState('100')

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const [selectedLog, setSelectedLog] = useState<AttendanceLogItem | null>(null)

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId]
  )

  const formatDateTime = (value?: string | null) => {
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

  const statusLabel = (status?: string | null) => {
    switch (status) {
      case 'present':
        return '출석'
      case 'late':
        return '지각'
      case 'absent':
        return '결석'
      default:
        return '-'
    }
  }

  const methodLabel = (method?: string | null) => {
    switch (method) {
      case 'manual':
        return 'manual'
      case 'qr':
        return 'qr'
      case 'nfc':
        return 'nfc'
      default:
        return '-'
    }
  }

  const getChangeSummary = (log: AttendanceLogItem) => {
    const before = log.before_value
    const after = log.after_value

    if (!before && after) {
      return '출석 기록 생성'
    }

    if (before && !after) {
      return '출석 기록 삭제'
    }

    const changes: string[] = []

    if (before?.status !== after?.status) {
      changes.push(`상태: ${statusLabel(before?.status)} → ${statusLabel(after?.status)}`)
    }

    if (before?.method !== after?.method) {
      changes.push(`방식: ${methodLabel(before?.method)} → ${methodLabel(after?.method)}`)
    }

    if (before?.check_time !== after?.check_time) {
      changes.push('체크 시간 변경')
    }

    return changes.length > 0 ? changes.join(', ') : '세부 변경 없음'
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

    return fetchedEvents as EventItem[]
  }

  const fetchLogs = async (params?: {
    eventId?: string
    date?: string
    limit?: string
  }) => {
    const effectiveEventId = params?.eventId ?? selectedEventId
    const effectiveDate = params?.date ?? selectedDate
    const effectiveLimit = params?.limit ?? limit

    const response = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: effectiveEventId || undefined,
        date: effectiveDate || undefined,
        limit: Number(effectiveLimit || 100),
      }),
    })

    const result = response.headers
      .get('content-type')
      ?.includes('application/json')
      ? await response.json()
      : { error: '로그 응답 형식이 올바르지 않습니다.' }

    if (!response.ok) {
      throw new Error(result.error || '로그를 불러오지 못했습니다.')
    }

    setLogs(result.logs ?? [])
  }

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true)
        setErrorMessage('')
        setMessage('')

        const fetchedEvents = await fetchEvents()

        if (fetchedEvents.length > 0 && !selectedEventId) {
          setSelectedEventId(fetchedEvents[0].id)
        }

        await fetchLogs({
          eventId: fetchedEvents[0]?.id || '',
          date: '',
          limit: '100',
        })
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

  const handleSearch = async () => {
    try {
      setLoading(true)
      setErrorMessage('')
      setMessage('')

      const parsedLimit = Number(limit)
      if (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
        setErrorMessage('조회 개수는 1~500 사이여야 합니다.')
        return
      }

      if (selectedDate && !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        setErrorMessage('날짜 형식이 올바르지 않습니다.')
        return
      }

      await fetchLogs()
      setMessage('로그를 조회했습니다.')
    } catch (error) {
      console.error(error)
      setErrorMessage(
        error instanceof Error ? error.message : '로그 조회 중 오류가 발생했습니다.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>출석 로그 조회</h2>

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
            gridTemplateColumns: '1fr 220px 160px auto',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>이벤트</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            >
              <option value="">전체 이벤트</option>
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

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>조회 개수</label>
            <input
              type="number"
              min="1"
              max="500"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void handleSearch()} disabled={loading}>
              {loading ? '조회중...' : '조회'}
            </button>
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
        <h3 style={{ marginTop: 0 }}>로그 목록</h3>

        {loading ? (
          <p>로딩중...</p>
        ) : logs.length === 0 ? (
          <p>조회된 로그가 없습니다.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>수정 시각</th>
                  <th style={thStyle}>수정자</th>
                  <th style={thStyle}>대상자</th>
                  <th style={thStyle}>이벤트</th>
                  <th style={thStyle}>날짜</th>
                  <th style={thStyle}>변경 내용</th>
                  <th style={thStyle}>상세</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={tdStyle}>{formatDateTime(log.changed_at)}</td>
                    <td style={tdStyle}>
                      {log.changed_by
                        ? `${log.changed_by.full_name} (${log.changed_by.student_id})`
                        : '-'}
                    </td>
                    <td style={tdStyle}>
                      {log.target_user
                        ? `${log.target_user.full_name} (${log.target_user.student_id})`
                        : '-'}
                    </td>
                    <td style={tdStyle}>{log.event?.name || '-'}</td>
                    <td style={tdStyle}>{log.date || '-'}</td>
                    <td style={tdStyle}>{getChangeSummary(log)}</td>
                    <td style={tdStyle}>
                      <button type="button" onClick={() => setSelectedLog(log)}>
                        보기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedLog && (
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
              maxWidth: '900px',
              maxHeight: '90vh',
              overflow: 'auto',
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <h3 style={{ marginTop: 0 }}>로그 상세</h3>

            <div style={{ marginBottom: '16px' }}>
              <div><strong>수정 시각:</strong> {formatDateTime(selectedLog.changed_at)}</div>
              <div>
                <strong>수정자:</strong>{' '}
                {selectedLog.changed_by
                  ? `${selectedLog.changed_by.full_name} (${selectedLog.changed_by.student_id})`
                  : '-'}
              </div>
              <div>
                <strong>대상자:</strong>{' '}
                {selectedLog.target_user
                  ? `${selectedLog.target_user.full_name} (${selectedLog.target_user.student_id})`
                  : '-'}
              </div>
              <div><strong>이벤트:</strong> {selectedLog.event?.name || '-'}</div>
              <div><strong>날짜:</strong> {selectedLog.date || '-'}</div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}
            >
              <div>
                <h4>변경 전</h4>
                <pre
                  style={{
                    background: '#f8f8f8',
                    border: '1px solid #eee',
                    borderRadius: '8px',
                    padding: '12px',
                    overflow: 'auto',
                    fontSize: '13px',
                  }}
                >
                  {JSON.stringify(selectedLog.before_value, null, 2)}
                </pre>
              </div>

              <div>
                <h4>변경 후</h4>
                <pre
                  style={{
                    background: '#f8f8f8',
                    border: '1px solid #eee',
                    borderRadius: '8px',
                    padding: '12px',
                    overflow: 'auto',
                    fontSize: '13px',
                  }}
                >
                  {JSON.stringify(selectedLog.after_value, null, 2)}
                </pre>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <button type="button" onClick={() => setSelectedLog(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
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
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchSessionUser, hasRole } from '@/lib/auth'

type StoredUser = {
  id: string
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
}

type EventType = 'normal' | 'special'

type EventItem = {
  id: string
  name: string
  type: EventType
  start_time: string
  late_threshold_min: number
  allow_duplicate: boolean
  created_at?: string
}

type AttendanceStatus = 'present' | 'late'

type AttendanceItem = {
  id: string
  event_id: string
  user_id: string
  status: AttendanceStatus
  checked_at?: string
  created_at?: string
  users?: {
    id: string
    full_name: string
    student_id: string
    role: 'admin' | 'captain' | 'trainee'
  } | null
}

type AttendanceSummary = {
  total: number
  present: number
  late: number
}

export default function AdminAttendancePage() {
  const router = useRouter()

  const [actor, setActor] = useState<StoredUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [attendanceLoading, setAttendanceLoading] = useState(false)

  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [attendances, setAttendances] = useState<AttendanceItem[]>([])
  const [summary, setSummary] = useState<AttendanceSummary>({
    total: 0,
    present: 0,
    late: 0,
  })

  const [keyword, setKeyword] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const init = async () => {
      try {
        const savedUser = (await fetchSessionUser()) as StoredUser | null

        if (!savedUser) {
          router.replace('/login')
          return
        }

        if (!hasRole(savedUser, ['admin'])) {
          alert('관리자만 접근할 수 있습니다.')
          router.replace('/')
          return
        }

        setActor(savedUser)
        await fetchEvents()
      } catch (error) {
        console.error(error)
        setErrorMessage('초기 데이터 조회 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    void init()
  }, [router])

  useEffect(() => {
    if (!selectedEventId) return
    void fetchAttendance(selectedEventId)
  }, [selectedEventId])

  const selectedEvent = useMemo(() => {
    return events.find((event) => event.id === selectedEventId) ?? null
  }, [events, selectedEventId])

  const filteredAttendances = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return attendances

    return attendances.filter((item) => {
      const value = [
        item.users?.full_name ?? '',
        item.users?.student_id ?? '',
        item.users?.role ?? '',
        item.status ?? '',
        item.checked_at ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return value.includes(q)
    })
  }, [attendances, keyword])

  const fetchEvents = async () => {
    try {
      setEventsLoading(true)
      setErrorMessage('')

      const response = await fetch('/api/events/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const contentType = response.headers.get('content-type') || ''
      const result =
        contentType.includes('application/json')
          ? await response.json()
          : null

      if (!response.ok) {
        throw new Error(result?.error || '이벤트 목록 조회에 실패했습니다.')
      }

      const fetchedEvents = (result?.events ?? []) as EventItem[]
      setEvents(fetchedEvents)

      if (fetchedEvents.length > 0) {
        setSelectedEventId((prev) => prev || fetchedEvents[0].id)
      }
    } catch (error) {
      console.error(error)
      setErrorMessage(
        error instanceof Error ? error.message : '이벤트 목록 조회 중 오류가 발생했습니다.'
      )
    } finally {
      setEventsLoading(false)
    }
  }

  const fetchAttendance = async (eventId: string) => {
    try {
      setAttendanceLoading(true)
      setErrorMessage('')
      setMessage('')

      const response = await fetch('/api/attendance/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      })

      const contentType = response.headers.get('content-type') || ''
      const result =
        contentType.includes('application/json')
          ? await response.json()
          : null

      if (!response.ok) {
        throw new Error(result?.error || '출석 현황 조회에 실패했습니다.')
      }

      setAttendances((result?.attendances ?? []) as AttendanceItem[])
      setSummary(
        (result?.summary ?? {
          total: 0,
          present: 0,
          late: 0,
        }) as AttendanceSummary
      )
    } catch (error) {
      console.error(error)
      setErrorMessage(
        error instanceof Error ? error.message : '출석 현황 조회 중 오류가 발생했습니다.'
      )
      setAttendances([])
      setSummary({ total: 0, present: 0, late: 0 })
    } finally {
      setAttendanceLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (!selectedEventId) return
    await fetchAttendance(selectedEventId)
    setMessage('출석 현황을 새로고침했습니다.')
  }

  const formatDateTime = (value?: string) => {
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

  if (loading || !actor) {
    return <div style={{ padding: '20px' }}>로딩중...</div>
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>출석 현황</h2>

      <p style={{ marginBottom: '20px' }}>
        관리자: {actor.full_name} ({actor.student_id})
      </p>

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '12px',
          padding: '16px',
          background: '#fff',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(240px, 360px) minmax(0, 1fr)',
            gap: '16px',
            alignItems: 'end',
          }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>이벤트 선택</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              style={{ width: '100%', padding: '10px' }}
              disabled={eventsLoading}
            >
              {events.length === 0 ? (
                <option value="">이벤트 없음</option>
              ) : (
                events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} / {formatDateTime(event.start_time)}
                  </option>
                ))
              )}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={handleRefresh} disabled={attendanceLoading || !selectedEventId}>
              {attendanceLoading ? '불러오는 중...' : '새로고침'}
            </button>
            <button type="button" onClick={() => router.push('/admin/events')}>
              이벤트 관리로
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
              borderRadius: '10px',
              background: '#f8fafc',
              lineHeight: 1.7,
            }}
          >
            <div><strong>이벤트명:</strong> {selectedEvent.name}</div>
            <div><strong>타입:</strong> {selectedEvent.type}</div>
            <div><strong>시작 시간:</strong> {formatDateTime(selectedEvent.start_time)}</div>
            <div><strong>지각 기준:</strong> {selectedEvent.late_threshold_min}분</div>
          </div>
        )}

        {message && (
          <p style={{ color: 'green', marginTop: '12px' }}>✅ {message}</p>
        )}

        {errorMessage && (
          <p style={{ color: 'crimson', marginTop: '12px' }}>⚠️ {errorMessage}</p>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <SummaryCard title="총 출석" value={summary.total} />
        <SummaryCard title="정상 출석" value={summary.present} />
        <SummaryCard title="지각" value={summary.late} />
      </div>

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '12px',
          padding: '16px',
          background: '#fff',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: '12px',
          }}
        >
          <h3 style={{ margin: 0 }}>출석 목록</h3>

          <input
            type="text"
            placeholder="이름 / 학번 / 상태 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ padding: '8px 10px', minWidth: '240px' }}
          />
        </div>

        {attendanceLoading ? (
          <p style={{ color: '#666' }}>출석 데이터를 불러오는 중입니다...</p>
        ) : filteredAttendances.length === 0 ? (
          <p style={{ color: '#666' }}>출석 데이터가 없습니다.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: '900px',
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>이름</th>
                  <th style={thStyle}>학번</th>
                  <th style={thStyle}>역할</th>
                  <th style={thStyle}>출석 상태</th>
                  <th style={thStyle}>출석 시간</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendances.map((item) => (
                  <tr key={item.id}>
                    <td style={tdStyle}>{item.users?.full_name ?? '-'}</td>
                    <td style={tdStyle}>{item.users?.student_id ?? '-'}</td>
                    <td style={tdStyle}>{item.users?.role ?? '-'}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          background: item.status === 'late' ? '#fff7ed' : '#ecfeff',
                          color: item.status === 'late' ? '#c2410c' : '#0f766e',
                          fontWeight: 600,
                          fontSize: '13px',
                        }}
                      >
                        {item.status === 'late' ? '지각' : '정상'}
                      </span>
                    </td>
                    <td style={tdStyle}>{formatDateTime(item.checked_at || item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  title,
  value,
}: {
  title: string
  value: number
}) {
  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '12px',
        padding: '16px',
        background: '#fff',
      }}
    >
      <div style={{ fontSize: '14px', color: '#666', marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: '28px', fontWeight: 700 }}>{value}</div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  borderBottom: '1px solid #ddd',
  padding: '10px',
  background: '#fafafa',
  verticalAlign: 'top',
}

const tdStyle: React.CSSProperties = {
  borderBottom: '1px solid #eee',
  padding: '10px',
  verticalAlign: 'top',
}
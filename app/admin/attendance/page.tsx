'use client'

import { useEffect, useState } from 'react'
//vercel 빌드 형식 dynamic으로 선언
export const dynamic = 'force-dynamic'

type EventItem = {
  id: string
  name: string
  start_time: string
}

type AttendanceItem = {
  id: string
  user_id: string
  event_id: string
  date: string
  status: 'present' | 'late' | 'absent'
  method: 'manual' | 'qr' | 'nfc'
  check_time: string
  user: {
    id: string
    full_name: string
    student_id: string
    role: 'admin' | 'captain' | 'trainee'
  } | null
  event: {
    id: string
    name: string
  } | null
}

export default function AdminAttendancePage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [eventId, setEventId] = useState('')
  const [date, setDate] = useState('')

  const [loading, setLoading] = useState(false)
  const [initLoading, setInitLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [attendance, setAttendance] = useState<AttendanceItem[]>([])

  useEffect(() => {
    const init = async () => {
      try {
        setInitLoading(true)

        const today = new Date()
        const yyyy = today.getFullYear()
        const mm = String(today.getMonth() + 1).padStart(2, '0')
        const dd = String(today.getDate()).padStart(2, '0')
        setDate(`${yyyy}-${mm}-${dd}`)

        const response = await fetch('/api/events/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        })

        const result = await response.json()

        if (!response.ok) {
          setErrorMessage(result?.error || '이벤트 목록을 불러오지 못했습니다.')
          return
        }

        const fetchedEvents = result?.events ?? []
        setEvents(fetchedEvents)

        if (fetchedEvents.length > 0) {
          setEventId(fetchedEvents[0].id)
        }
      } catch (error) {
        console.error('초기화 실패:', error)
        setErrorMessage('초기화 중 오류가 발생했습니다.')
      } finally {
        setInitLoading(false)
      }
    }

    init()
  }, [])

  async function handleSearch() {
    setErrorMessage('')

    if (!eventId || !date) {
      setErrorMessage('이벤트와 날짜를 선택해주세요.')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/attendance/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          event_id: eventId,
          date,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setErrorMessage(result?.error || '출석 현황을 불러오지 못했습니다.')
        return
      }

      setAttendance(result?.attendance ?? [])
    } catch (error) {
      console.error('출석 조회 실패:', error)
      setErrorMessage('출석 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (initLoading) {
    return <div style={{ padding: '20px' }}>로딩중...</div>
  }

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '12px',
        background: '#fff',
        padding: '20px',
      }}
    >
      <h2 style={{ marginTop: 0 }}>출석 현황</h2>

      <div style={{ display: 'grid', gap: '12px', maxWidth: '520px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>이벤트</label>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          >
            {events.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px' }}>날짜</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          />
        </div>

        <div>
          <button type="button" onClick={handleSearch} disabled={loading}>
            {loading ? '조회 중...' : '조회'}
          </button>
        </div>
      </div>

      {errorMessage && <p style={{ color: 'red', marginTop: '16px' }}>{errorMessage}</p>}

      <div style={{ marginTop: '24px' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #ddd',
          }}
        >
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>이름</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>학번</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>상태</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>방법</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>체크 시간</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>
                  조회된 출석 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              attendance.map((item) => (
                <tr key={item.id}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    {item.user?.full_name ?? '-'}
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    {item.user?.student_id ?? '-'}
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.status}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.method}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.check_time}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
// app/admin/admin-only/events/eventsClient.tsx
'use client'

import { useEffect, useState } from 'react'

type EventItem = {
  id: string
  name: string
  start_time: string
  late_threshold_min: number
}

export default function EventsClient() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchEvents() {
    try {
      setLoading(true)
      setError('')

      const res = await fetch('/api/events/list', {
        method: 'GET',
        cache: 'no-store',
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '이벤트 조회 실패')
        return
      }

      setEvents(data.events ?? [])
    } catch {
      setError('이벤트 조회 중 오류 발생')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchEvents()
  }, [])

  if (loading) return <div>로딩중...</div>

  return (
    <div style={{ padding: 20 }}>
      <h2>이벤트 관리</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button onClick={fetchEvents}>새로고침</button>

      <table style={{ width: '100%', marginTop: 20 }}>
        <thead>
          <tr>
            <th>이름</th>
            <th>시작시간</th>
            <th>지각 기준</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{e.name}</td>
              <td>{new Date(e.start_time).toLocaleString()}</td>
              <td>{e.late_threshold_min}분</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
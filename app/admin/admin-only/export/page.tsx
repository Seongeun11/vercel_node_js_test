'use client'

import { useEffect, useState } from 'react'
import AdminHeader from '@/components/admin/AdminHeader'

type EventItem = {
  id: string
  name: string
  start_time: string
}

type EventsListResponse = {
  items?: EventItem[]
  error?: string
}

function getTodayDate(): string {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export default function AttendanceExportPage() {
  const today = getTodayDate()

  const [events, setEvents] = useState<EventItem[]>([])
  const [eventId, setEventId] = useState('')
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth(today))
  const [dateTo, setDateTo] = useState(today)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true)
        setErrorMessage('')

        const response = await fetch('/api/events/list', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        })

        const text = await response.text()
        const result: EventsListResponse = text ? JSON.parse(text) : {}

        if (!response.ok) {
          setErrorMessage(result.error || '이벤트 목록을 불러오지 못했습니다.')
          return
        }

        const nextEvents = result.items ?? []
        setEvents(nextEvents)

        if (nextEvents.length > 0) {
          setEventId(nextEvents[0].id)
        }
      } catch (error) {
        console.error('[attendance/export] events fetch error:', error)
        setErrorMessage('이벤트 목록 조회 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    void fetchEvents()
  }, [])
  // 매월 한국표준시 1일 반환 (YYYY-MM-DD)
  function getFirstDayOfMonth(date?: string): string {
    const base = date ? new Date(date) : new Date()

    const year = base.getFullYear()
    const month = String(base.getMonth() + 1).padStart(2, '0')

    return `${year}-${month}-01`
  }
  function handleDownloadExcel() {
    setErrorMessage('')

    if (!eventId) {
      setErrorMessage('이벤트를 선택해주세요.')
      return
    }

    if (!dateFrom || !dateTo) {
      setErrorMessage('조회 시작일과 종료일을 선택해주세요.')
      return
    }

    if (dateFrom > dateTo) {
      setErrorMessage('조회 시작일은 종료일보다 늦을 수 없습니다.')
      return
    }

    const params = new URLSearchParams()
    params.set('event_id', eventId)
    params.set('date_from', dateFrom)
    params.set('date_to', dateTo)

    window.location.href = `/api/admin/attendance/export?${params.toString()}`
  }

  if (loading) {
    return <div style={{ padding: '24px' }}>로딩중...</div>
  }

  return (
    <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
      <AdminHeader
        title="출석현황 엑셀 다운로드"
        description="이벤트와 날짜 범위를 선택해 출석현황을 엑셀 파일로 다운로드합니다."
      />

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '12px',
          background: '#fff',
          padding: '20px',
        }}
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>
              이벤트
            </label>
            <select
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                boxSizing: 'border-box',
              }}
            >
              {events.length === 0 ? (
                <option value="">이벤트 없음</option>
              ) : (
                events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>
              시작일 (자동: 매월 1일)
            </label>
            <input
              type="date"
              value={dateFrom}
              readOnly
              style={{
                width: '100%',
                padding: '10px',
                boxSizing: 'border-box',
                background: '#f3f4f6',
                cursor: 'not-allowed',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>
              종료일
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button type="button" onClick={handleDownloadExcel}>
            엑셀 다운로드
          </button>
        </div>

        {errorMessage && (
          <p style={{ color: 'red', marginTop: '16px' }}>{errorMessage}</p>
        )}

        <div
          style={{
            marginTop: '20px',
            padding: '12px',
            borderRadius: '8px',
            background: '#f8fafc',
            color: '#475569',
            fontSize: '14px',
          }}
        >
          엑셀 형식: 출석번호 / 이름 / 날짜별 출석 상태
          <br />
          파일명과 시트명은 선택한 이벤트명으로 생성됩니다.
        </div>
      </div>
    </div>
  )
}
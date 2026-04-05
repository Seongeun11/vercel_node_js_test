'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
//vercel 빌드 형식 dynamic으로 선언
export const dynamic = 'force-dynamic'

type EventItem = {
  id: string
  name: string
  start_time: string
  late_threshold_min: number
}

export default function AdminQrPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [eventId, setEventId] = useState('')
  const [expireMinutes, setExpireMinutes] = useState('3')

  const [loading, setLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)

  const [qrUrl, setQrUrl] = useState('')
  const [qrImageUrl, setQrImageUrl] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true)
        setErrorMessage('')

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
        console.error('이벤트 조회 실패:', error)
        setErrorMessage('이벤트 목록 조회 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === eventId) ?? null,
    [events, eventId]
  )

  function formatDateTime(value: string) {
    try {
      return new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(value))
    } catch {
      return value
    }
  }

  async function handleCreateQr() {
    setMessage('')
    setErrorMessage('')
    setQrUrl('')
    setQrImageUrl('')

    if (!eventId) {
      setErrorMessage('이벤트를 선택해주세요.')
      return
    }

    try {
      setSubmitLoading(true)

      const response = await fetch('/api/qr/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          event_id: eventId,
          expire_minutes: Number(expireMinutes),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setErrorMessage(result?.error || 'QR 생성에 실패했습니다.')
        return
      }

      const origin = window.location.origin
      const scanUrl = `${origin}/attendance/scan?token=${result.qr_token.token}`

      setQrUrl(scanUrl)
      setMessage(result?.message || 'QR이 생성되었습니다.')

      const dataUrl = await QRCode.toDataURL(scanUrl, {
        width: 280,
        margin: 2,
      })

      setQrImageUrl(dataUrl)
    } catch (error) {
      console.error('QR 생성 실패:', error)
      setErrorMessage('QR 생성 중 오류가 발생했습니다.')
    } finally {
      setSubmitLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>로딩중...</div>
  }

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '12px',
        background: '#fff',
        padding: '20px',
        maxWidth: '720px',
      }}
    >
      <h2 style={{ marginTop: 0 }}>QR 출석 생성</h2>

      <label style={{ display: 'block', marginBottom: '6px' }}>이벤트 선택</label>
      <select
        value={eventId}
        onChange={(e) => setEventId(e.target.value)}
        style={{ width: '100%', padding: '10px', marginBottom: '12px', boxSizing: 'border-box' }}
      >
        {events.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} / {formatDateTime(item.start_time)}
          </option>
        ))}
      </select>

      {selectedEvent && (
        <p style={{ marginBottom: '12px', color: '#666' }}>
          선택된 이벤트: {selectedEvent.name}
        </p>
      )}

      <label style={{ display: 'block', marginBottom: '6px' }}>QR 유효 시간(분)</label>
      <input
        type="number"
        min="1"
        max="60"
        value={expireMinutes}
        onChange={(e) => setExpireMinutes(e.target.value)}
        style={{ width: '100%', padding: '10px', marginBottom: '16px', boxSizing: 'border-box' }}
      />

      <button type="button" onClick={handleCreateQr} disabled={submitLoading}>
        {submitLoading ? '생성 중...' : 'QR 생성'}
      </button>

      {message && <p style={{ color: 'green', marginTop: '16px' }}>{message}</p>}
      {errorMessage && <p style={{ color: 'red', marginTop: '16px' }}>{errorMessage}</p>}

      {qrImageUrl && (
        <div style={{ marginTop: '24px' }}>
          <img src={qrImageUrl} alt="QR Code" />
          <p style={{ wordBreak: 'break-all' }}>{qrUrl}</p>
        </div>
      )}
    </div>
  )
}
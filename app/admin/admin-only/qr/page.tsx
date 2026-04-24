// app/admin/admin-only/qr/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import AdminHeader from '@/components/admin/AdminHeader'

export const dynamic = 'force-dynamic'

type EventItem = {
  id: string
  name: string
  start_time: string
  late_threshold_min: number
}

type EventsListResponse = {
  items?: EventItem[]
  error?: string
}

type QrCreateResponse = {
  message?: string
  qr_token?: {
    id: string
    event_id: string
    occurrence_id: string | null
    expires_at: string | null
    used_count: number
    created_at: string
    token_preview: string
  }
  qr_url?: string
  error?: string
}

export default function AdminQrPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [eventId, setEventId] = useState('')
  const [expireMinutes, setExpireMinutes] = useState('60')

  const [loading, setLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)

  const [qrUrl, setQrUrl] = useState('')
  const [qrImageUrl, setQrImageUrl] = useState('')
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)

  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const fetchEvents = async () => {
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
          setErrorMessage(result?.error || '이벤트 목록을 불러오지 못했습니다.')
          return
        }

        const fetchedEvents = result.items ?? []
        setEvents(fetchedEvents)

        if (fetchedEvents.length > 0) {
          setEventId(fetchedEvents[0].id)
        }
      } catch (error) {
        console.error('[admin/qr] 이벤트 조회 실패:', error)
        setErrorMessage('이벤트 목록 조회 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    void fetchEvents()
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

  async function handleCopyQrUrl() {
    if (!qrUrl) {
      alert('복사할 QR 링크가 없습니다.')
      return
    }

    try {
      await navigator.clipboard.writeText(qrUrl)
      alert('QR 링크가 복사되었습니다.')
    } catch {
      setErrorMessage('QR 링크 복사에 실패했습니다.')
    }
  }

  async function handleCreateQr() {
    setMessage('')
    setErrorMessage('')
    setQrUrl('')
    setQrImageUrl('')
    setIsQrModalOpen(false)

    if (!eventId) {
      setErrorMessage('이벤트를 선택해주세요.')
      return
    }

    const minutes = Number(expireMinutes)

    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 360) {
      setErrorMessage('QR 유효 시간은 1~360분 사이 정수여야 합니다.')
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
          expire_minutes: minutes,
        }),
      })

      const text = await response.text()
      const result: QrCreateResponse = text ? JSON.parse(text) : {}

      if (!response.ok) {
        setErrorMessage(result.error || 'QR 생성에 실패했습니다.')
        return
      }

      // 핵심: token을 직접 조합하지 않고 백엔드 qr_url만 사용
      if (!result.qr_url) {
        setErrorMessage('QR 링크가 응답에 없습니다.')
        return
      }

      setQrUrl(result.qr_url)
      setMessage(result.message || 'QR이 생성되었습니다.')

      const dataUrl = await QRCode.toDataURL(result.qr_url, {
        width: 280,
        margin: 2,
      })

      setQrImageUrl(dataUrl)
    } catch (error) {
      console.error('[admin/qr] QR 생성 실패:', error)
      setErrorMessage('QR 생성 중 오류가 발생했습니다.')
    } finally {
      setSubmitLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>로딩중...</div>
  }

  return (
    <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
      <AdminHeader
        title="QR 생성"
        description="행사 출석용 QR을 생성하고 스캔 URL을 확인할 수 있습니다."
      />

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '12px',
          background: '#fff',
          padding: '20px',
        }}
      >
        <label style={{ display: 'block', marginBottom: '6px' }}>이벤트 선택</label>
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '12px',
            boxSizing: 'border-box',
          }}
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
          max="360"
          value={expireMinutes}
          onChange={(e) => setExpireMinutes(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '16px',
            boxSizing: 'border-box',
          }}
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

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button type="button" onClick={handleCopyQrUrl}>
                QR 링크 복사
              </button>

              <button type="button" onClick={() => setIsQrModalOpen(true)}>
                QR 크게보기
              </button>
            </div>
          </div>
        )}
      </div>

      {isQrModalOpen && qrImageUrl && (
        <div
          onClick={() => setIsQrModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '16px',
              textAlign: 'center',
              maxWidth: '520px',
              width: '100%',
            }}
          >
            <img
              src={qrImageUrl}
              alt="QR Code Large"
              style={{
                width: '420px',
                height: '420px',
                maxWidth: '80vw',
                maxHeight: '80vw',
              }}
            />

            <p style={{ wordBreak: 'break-all', marginTop: '12px' }}>{qrUrl}</p>

            <button type="button" onClick={() => setIsQrModalOpen(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
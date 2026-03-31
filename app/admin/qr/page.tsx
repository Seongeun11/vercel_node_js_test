'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { getStoredUser, hasRole } from '@/lib/auth'

type StoredUser = {
    id: string
    full_name: string
    student_id: string
    role: 'admin' | 'captain' | 'trainee'
    }

type EventItem = {
    id: string
    name: string
    start_time: string
    late_threshold_min: number
    }

export default function AdminQrPage() {
const router = useRouter()

const [actor, setActor] = useState<StoredUser | null>(null)
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
        const savedUser = getStoredUser() as StoredUser | null

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
    }, [router])

useEffect(() => {
        if (!actor?.id) return

        const fetchEvents = async () => {
        try {
            setLoading(true)
            setErrorMessage('')

            const response = await fetch('/api/events/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actor_user_id: actor.id }),
            })

            const result =
            response.headers.get('content-type')?.includes('application/json')
                ? await response.json()
                : { error: '이벤트 목록 응답 형식이 올바르지 않습니다.' }

            if (!response.ok) {
            setErrorMessage(result.error || '이벤트 목록을 불러오지 못했습니다.')
            return
            }

            const fetchedEvents = result.events ?? []
            setEvents(fetchedEvents)

            if (fetchedEvents.length > 0) {
            setEventId(fetchedEvents[0].id)
            }
        } catch (error) {
            console.error(error)
            setErrorMessage('이벤트 목록 조회 중 오류가 발생했습니다.')
        } finally {
            setLoading(false)
        }
        }

        fetchEvents()
    }, [actor])

const selectedEvent = useMemo(
        () => events.find((event) => event.id === eventId) ?? null,
        [events, eventId]
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
            hour12: false,
        }).format(new Date(value))
        } catch {
        return value
        }
}

const handleCreateQr = async () => {
        try {
        setSubmitLoading(true)
        setErrorMessage('')
        setMessage('')
        setQrUrl('')
        setQrImageUrl('')

        if (!actor?.id) {
            setErrorMessage('로그인이 필요합니다.')
            return
        }

        if (!eventId) {
            setErrorMessage('이벤트를 선택해주세요.')
            return
        }

        const response = await fetch('/api/qr/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            actor_user_id: actor.id,
            event_id: eventId,
            expire_minutes: Number(expireMinutes),
            }),
        })

            let result: any = {}

            const contentType = response.headers.get('content-type') || ''

            if (contentType.includes('application/json')) {
            result = await response.json()
            } else {
            const text = await response.text()
            console.error('QR create non-JSON response:', text)
            result = {
                error: `QR 생성 API가 JSON이 아닌 응답을 반환했습니다. status=${response.status}`,
            }
            }

        if (!response.ok) {
            setErrorMessage(result.error || 'QR 생성에 실패했습니다.')
            return
        }

    const origin = window.location.origin
    const scanUrl = `${origin}/attendance/scan?token=${result.qr_token.token}`

    setQrUrl(scanUrl)
    setMessage(result.message || 'QR이 생성되었습니다.')

    const dataUrl = await QRCode.toDataURL(scanUrl, {
        width: 280,
        margin: 2,
        })

        setQrImageUrl(dataUrl)
        } catch (error) {
        console.error(error)
        setErrorMessage('QR 생성 중 오류가 발생했습니다.')
        } finally {
        setSubmitLoading(false)
        }
}

if (!actor || loading) {
        return <div style={{ padding: '20px' }}>로딩중...</div>
}

return (
        <div style={{ padding: '20px', maxWidth: '640px', margin: '0 auto' }}>
        <h2>QR 출석 생성</h2>

        <p style={{ marginBottom: '16px' }}>
            관리자: {actor.full_name} ({actor.student_id})
        </p>

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

        <label style={{ display: 'block', marginBottom: '6px' }}>QR 유효 시간(분)</label>
        <input
            type="number"
            min="1"
            max="10"
            value={expireMinutes}
            onChange={(e) => setExpireMinutes(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '16px', boxSizing: 'border-box' }}
        />

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={handleCreateQr} disabled={submitLoading}>
            {submitLoading ? '생성중...' : 'QR 생성'}
            </button>

            <button onClick={() => router.push('/admin')}>관리자 페이지로</button>
            <button onClick={() => router.push('/')}>메인으로</button>
        </div>

        {selectedEvent && (
            <div style={{ marginTop: '20px', padding: '12px', border: '1px solid #ddd', borderRadius: '8px' }}>
            <div><strong>선택 이벤트:</strong> {selectedEvent.name}</div>
            <div><strong>시작 시간:</strong> {formatDateTime(selectedEvent.start_time)}</div>
            <div><strong>지각 기준:</strong> {selectedEvent.late_threshold_min}분</div>
            </div>
        )}

        {message && <p style={{ color: 'green', marginTop: '16px' }}>✅ {message}</p>}
        {errorMessage && <p style={{ color: 'crimson', marginTop: '16px' }}>⚠️ {errorMessage}</p>}

        {qrImageUrl && (
            <div
            style={{
                marginTop: '24px',
                padding: '20px',
                border: '1px solid #ddd',
                borderRadius: '12px',
                textAlign: 'center',
                backgroundColor: '#fff',
            }}
            >
            <h3>생성된 QR</h3>
            <img src={qrImageUrl} alt="QR Code" style={{ width: 280, height: 280 }} />
            <p style={{ marginTop: '12px', wordBreak: 'break-all', fontSize: '12px' }}>
                {qrUrl}
            </p>
            </div>
        )}
        </div>
    )
}
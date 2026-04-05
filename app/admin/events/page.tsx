'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type EventItem = {
  id: string
  name: string
  start_time: string
  late_threshold_min: number
  allow_duplicate_check?: boolean
  created_at?: string
}

type EventForm = {
  name: string
  start_time: string
  late_threshold_min: string
  allow_duplicate_check: boolean
}

const INITIAL_FORM: EventForm = {
  name: '',
  start_time: '',
  late_threshold_min: '5',
  allow_duplicate_check: false,
}

export default function AdminEventsPage() {
  const router = useRouter()

  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null)

  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [form, setForm] = useState<EventForm>(INITIAL_FORM)

  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const selectedEditingEvent = useMemo(
    () => events.find((event) => event.id === editingEventId) ?? null,
    [events, editingEventId]
  )

  const resetForm = () => {
    setForm(INITIAL_FORM)
    setEditingEventId(null)
  }

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

  const fetchEvents = async () => {
    try {
      setLoading(true)
      setErrorMessage('')

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
        setErrorMessage(result.error || '이벤트 목록을 불러오지 못했습니다.')
        return
      }

      setEvents(result.events ?? [])
    } catch (error) {
      console.error(error)
      setErrorMessage('이벤트 목록 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchEvents()
  }, [])

  const validateForm = () => {
    if (!form.name.trim()) return '이벤트명을 입력해주세요.'
    if (!form.start_time.trim()) return '시작 시간을 입력해주세요.'

    const lateThreshold = Number(form.late_threshold_min)
    if (!Number.isFinite(lateThreshold) || lateThreshold < 0 || lateThreshold > 180) {
      return '지각 기준은 0~180분 사이여야 합니다.'
    }

    return ''
  }

  const handleChange = <K extends keyof EventForm>(key: K, value: EventForm[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleEdit = (event: EventItem) => {
    setEditingEventId(event.id)
    setMessage('')
    setErrorMessage('')
    setForm({
      name: event.name ?? '',
      start_time: toDatetimeLocalValue(event.start_time),
      late_threshold_min: String(event.late_threshold_min ?? 5),
      allow_duplicate_check: Boolean(event.allow_duplicate_check),
    })
  }

  const toDatetimeLocalValue = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')

    return `${yyyy}-${mm}-${dd}T${hh}:${min}`
  }

  const handleSubmit = async () => {
    try {
      setSubmitLoading(true)
      setMessage('')
      setErrorMessage('')

      const validationError = validateForm()
      if (validationError) {
        setErrorMessage(validationError)
        return
      }

      const payload = {
        name: form.name.trim(),
        start_time: new Date(form.start_time).toISOString(),
        late_threshold_min: Number(form.late_threshold_min),
        allow_duplicate_check: form.allow_duplicate_check,
      }

      const isEditing = Boolean(editingEventId)
      const url = isEditing ? '/api/events/update' : '/api/events/create'
      const body = isEditing
        ? JSON.stringify({ id: editingEventId, ...payload })
        : JSON.stringify(payload)

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })

      const result = response.headers
        .get('content-type')
        ?.includes('application/json')
        ? await response.json()
        : { error: '이벤트 저장 응답 형식이 올바르지 않습니다.' }

      if (!response.ok) {
        setErrorMessage(result.error || '이벤트 저장에 실패했습니다.')
        return
      }

      setMessage(
        isEditing ? '이벤트가 수정되었습니다.' : '이벤트가 생성되었습니다.'
      )

      resetForm()
      await fetchEvents()
    } catch (error) {
      console.error(error)
      setErrorMessage('이벤트 저장 중 오류가 발생했습니다.')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDelete = async (eventId: string) => {
    const confirmed = window.confirm('정말 이 이벤트를 삭제하시겠습니까?')
    if (!confirmed) return

    try {
      setDeleteLoadingId(eventId)
      setMessage('')
      setErrorMessage('')

      const response = await fetch('/api/events/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eventId }),
      })

      const result = response.headers
        .get('content-type')
        ?.includes('application/json')
        ? await response.json()
        : { error: '이벤트 삭제 응답 형식이 올바르지 않습니다.' }

      if (!response.ok) {
        setErrorMessage(result.error || '이벤트 삭제에 실패했습니다.')
        return
      }

      if (editingEventId === eventId) {
        resetForm()
      }

      setMessage('이벤트가 삭제되었습니다.')
      await fetchEvents()
    } catch (error) {
      console.error(error)
      setErrorMessage('이벤트 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeleteLoadingId(null)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '960px', margin: '0 auto' }}>
      <h2>이벤트 관리</h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 420px) 1fr',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '12px',
            padding: '20px',
            background: '#fff',
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            {selectedEditingEvent ? '이벤트 수정' : '이벤트 생성'}
          </h3>

          <label style={{ display: 'block', marginBottom: '6px' }}>이벤트명</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="예: 수요 워크숍"
            style={{ width: '100%', padding: '10px', marginBottom: '12px', boxSizing: 'border-box' }}
          />

          <label style={{ display: 'block', marginBottom: '6px' }}>시작 시간</label>
          <input
            type="datetime-local"
            value={form.start_time}
            onChange={(e) => handleChange('start_time', e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '12px', boxSizing: 'border-box' }}
          />

          <label style={{ display: 'block', marginBottom: '6px' }}>지각 기준(분)</label>
          <input
            type="number"
            min="0"
            max="180"
            value={form.late_threshold_min}
            onChange={(e) => handleChange('late_threshold_min', e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '12px', boxSizing: 'border-box' }}
          />

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <input
              type="checkbox"
              checked={form.allow_duplicate_check}
              onChange={(e) => handleChange('allow_duplicate_check', e.target.checked)}
            />
            중복 체크 허용
          </label>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={handleSubmit} disabled={submitLoading}>
              {submitLoading
                ? selectedEditingEvent
                  ? '수정중...'
                  : '생성중...'
                : selectedEditingEvent
                ? '이벤트 수정'
                : '이벤트 생성'}
            </button>

            {selectedEditingEvent && (
              <button type="button" onClick={resetForm}>
                취소
              </button>
            )}

            <button type="button" onClick={() => router.push('/admin')}>
              관리자 페이지로
            </button>
          </div>

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
          <h3 style={{ marginTop: 0 }}>이벤트 목록</h3>

          {loading ? (
            <p>로딩중...</p>
          ) : events.length === 0 ? (
            <p>등록된 이벤트가 없습니다.</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {events.map((event) => (
                <div
                  key={event.id}
                  style={{
                    border: '1px solid #eee',
                    borderRadius: '10px',
                    padding: '14px',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>{event.name}</div>
                  <div style={{ fontSize: '14px', color: '#555', marginBottom: '4px' }}>
                    시작 시간: {formatDateTime(event.start_time)}
                  </div>
                  <div style={{ fontSize: '14px', color: '#555', marginBottom: '4px' }}>
                    지각 기준: {event.late_threshold_min}분
                  </div>
                  <div style={{ fontSize: '14px', color: '#555', marginBottom: '10px' }}>
                    중복 체크 허용: {event.allow_duplicate_check ? '예' : '아니오'}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => handleEdit(event)}>
                      수정
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(event.id)}
                      disabled={deleteLoadingId === event.id}
                    >
                      {deleteLoadingId === event.id ? '삭제중...' : '삭제'}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/admin/qr?eventId=${encodeURIComponent(event.id)}`)
                      }
                    >
                      QR 생성으로
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
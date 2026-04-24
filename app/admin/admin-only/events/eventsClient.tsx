'use client'

import { useEffect, useMemo, useState } from 'react'

type RecurrenceType = 'none' | 'daily'
type WeekdayCode = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

type EventItem = {
  id: string
  name: string
  start_time: string
  late_threshold_min: number
  allow_duplicate_check: boolean
  is_special_event: boolean
  recurrence_type: RecurrenceType
  recurrence_days: WeekdayCode[]
  is_active: boolean
}

type EventFormState = {
  name: string
  start_time: string
  late_threshold_min: string
  allow_duplicate_check: boolean
  is_special_event: boolean
  recurrence_type: RecurrenceType
  recurrence_days: WeekdayCode[]
  is_active: boolean
}

const WEEKDAY_OPTIONS: { label: string; value: WeekdayCode }[] = [
  { label: '월', value: 'mon' },
  { label: '화', value: 'tue' },
  { label: '수', value: 'wed' },
  { label: '목', value: 'thu' },
  { label: '금', value: 'fri' },
  { label: '토', value: 'sat' },
  { label: '일', value: 'sun' },
]

const WEEKDAY_CODES = WEEKDAY_OPTIONS.map((option) => option.value)

function toDateTimeLocalValue(isoString: string) {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

const initialForm: EventFormState = {
  name: '',
  start_time: toDateTimeLocalValue(new Date().toISOString()),
  late_threshold_min: '5',
  allow_duplicate_check: false,
  is_special_event: false,
  recurrence_type: 'none',
  recurrence_days: [],
  is_active: true,
}

function normalizeRecurrenceDays(days: unknown): WeekdayCode[] {
  if (!Array.isArray(days)) return []

  const unique = Array.from(new Set(days.map((day) => String(day).trim())))

  return WEEKDAY_OPTIONS.map((option) => option.value).filter((day) =>
    unique.includes(day)
  )
}

function formatRecurrenceDays(days: WeekdayCode[]) {
  if (!days.length) return '반복 없음'

  const labelMap: Record<WeekdayCode, string> = {
    mon: '월',
    tue: '화',
    wed: '수',
    thu: '목',
    fri: '금',
    sat: '토',
    sun: '일',
  }

  return days.map((day) => labelMap[day]).join(', ')
}

export default function EventsClient() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState<EventFormState>(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  const isEditing = useMemo(() => editingId !== null, [editingId])

  async function fetchEvents() {
    const res = await fetch('/api/events/list', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || '이벤트 조회 실패')
    }

    return Array.isArray(data.items) ? (data.items as EventItem[]) : []
  }

  async function refreshEvents() {
    try {
      setLoading(true)
      setError('')

      const eventItems = await fetchEvents()
      setEvents(eventItems)
    } catch (err) {
      setError(err instanceof Error ? err.message : '이벤트 조회 중 오류 발생')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshEvents()
  }, [])

  function resetForm() {
    setForm({
      ...initialForm,
      start_time: toDateTimeLocalValue(new Date().toISOString()),
    })
    setEditingId(null)
  }

  function handleChange<K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  function toggleRecurrenceDay(day: WeekdayCode) {
    setForm((prev) => {
      const nextDays = prev.recurrence_days.includes(day)
        ? prev.recurrence_days.filter((item) => item !== day)
        : [...prev.recurrence_days, day]

      const normalizedDays = normalizeRecurrenceDays(nextDays)

      return {
        ...prev,
        recurrence_days: normalizedDays,
        recurrence_type: normalizedDays.length > 0 ? 'daily' : 'none',
      }
    })
  }

  function validateEventForm() {
    const name = form.name.trim()
    const startTime = form.start_time.trim()
    const lateThreshold = Number(form.late_threshold_min)
    const hasInvalidDay = form.recurrence_days.some(
      (day) => !WEEKDAY_CODES.includes(day)
    )

    if (!name) return '이벤트 이름을 입력해주세요.'
    if (!startTime) return '시작 시간을 입력해주세요.'
    if (Number.isNaN(new Date(startTime).getTime())) return '시작 시간 형식이 올바르지 않습니다.'

    if (
      !Number.isInteger(lateThreshold) ||
      lateThreshold < 0 ||
      lateThreshold > 180
    ) {
      return '지각 기준은 0~180 사이 정수여야 합니다.'
    }

    if (!['none', 'daily'].includes(form.recurrence_type)) {
      return '반복 규칙이 올바르지 않습니다.'
    }

    if (hasInvalidDay) {
      return '반복 요일 값이 올바르지 않습니다.'
    }

    if (form.recurrence_type === 'daily' && form.recurrence_days.length === 0) {
      return '반복 요일을 1개 이상 선택해주세요.'
    }

    return ''
  }

  async function handleSubmitEvent() {
    const validationError = validateEventForm()

    if (validationError) {
      setError(validationError)
      setSuccess('')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      const payload = {
        ...(isEditing ? { id: editingId } : {}),
        name: form.name.trim(),
        start_time: new Date(form.start_time).toISOString(),
        late_threshold_min: Number(form.late_threshold_min),
        allow_duplicate_check: form.allow_duplicate_check,
        is_special_event: form.is_special_event,
        recurrence_type: form.recurrence_type,
        recurrence_days: form.recurrence_type === 'daily' ? form.recurrence_days : [],
        is_active: form.is_active,
      }

      const endpoint = isEditing ? '/api/events/update' : '/api/events/create'

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(
          data.error || (isEditing ? '이벤트 수정 실패' : '이벤트 생성 실패')
        )
      }

      setSuccess(isEditing ? '이벤트가 수정되었습니다.' : '이벤트가 생성되었습니다.')
      resetForm()
      await refreshEvents()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEditing
            ? '이벤트 수정 중 오류 발생'
            : '이벤트 생성 중 오류 발생'
      )
    } finally {
      setSubmitting(false)
    }
  }

  function startEditEvent(event: EventItem) {
    setError('')
    setSuccess('')
    setEditingId(event.id)

    const days = normalizeRecurrenceDays(event.recurrence_days)

    setForm({
      name: event.name,
      start_time: toDateTimeLocalValue(event.start_time),
      late_threshold_min: String(event.late_threshold_min ?? 5),
      allow_duplicate_check: Boolean(event.allow_duplicate_check),
      is_special_event: Boolean(event.is_special_event),
      recurrence_type: days.length > 0 ? 'daily' : 'none',
      recurrence_days: days,
      is_active: Boolean(event.is_active),
    })
  }

  async function handleDeleteEvent(id: string) {
    const confirmed = window.confirm('정말 이 이벤트를 삭제하시겠습니까?')
    if (!confirmed) return

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      const res = await fetch('/api/events/delete', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '이벤트 삭제 실패')
      }

      if (editingId === id) resetForm()

      setSuccess('이벤트가 삭제되었습니다.')
      await refreshEvents()
    } catch (err) {
      setError(err instanceof Error ? err.message : '이벤트 삭제 중 오류 발생')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 20 }}>로딩중...</div>
  }

  return (
    <div style={{ padding: 20, display: 'grid', gap: 24 }}>
      <div>
        <h2 style={{ marginBottom: 8 }}>이벤트 관리</h2>
        <p style={{ color: '#666', margin: 0 }}>
          관리자 전용 이벤트 설정 화면입니다. 반복 규칙과 기본 속성을 관리합니다.
        </p>
      </div>

      <section style={panelStyle}>
        <h3 style={{ marginTop: 0 }}>{isEditing ? '이벤트 수정' : '이벤트 생성'}</h3>

        <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>이벤트 이름</span>
            <input
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="예: 새벽예배"
              style={inputStyle}
              disabled={submitting}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>기본 시작 시간</span>
            <input
              type="datetime-local"
              value={form.start_time}
              onChange={(e) => handleChange('start_time', e.target.value)}
              style={inputStyle}
              disabled={submitting}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>지각 기준(분)</span>
            <input
              type="number"
              min={0}
              max={180}
              step={1}
              value={form.late_threshold_min}
              onChange={(e) => handleChange('late_threshold_min', e.target.value)}
              style={inputStyle}
              disabled={submitting}
            />
          </label>

          <div style={{ display: 'grid', gap: 6 }}>
            <span>반복 요일</span>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {WEEKDAY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 10px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    background: form.recurrence_days.includes(option.value) ? '#eff6ff' : '#fff',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.recurrence_days.includes(option.value)}
                    onChange={() => toggleRecurrenceDay(option.value)}
                    disabled={submitting}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            <div style={{ fontSize: 13, color: '#666' }}>
              {form.recurrence_days.length > 0
                ? `선택된 요일: ${formatRecurrenceDays(form.recurrence_days)}`
                : '반복 없음'}
            </div>
          </div>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={form.allow_duplicate_check}
              onChange={(e) => handleChange('allow_duplicate_check', e.target.checked)}
              disabled={submitting}
            />
            <span>중복 출석 허용</span>
          </label>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={form.is_special_event}
              onChange={(e) => handleChange('is_special_event', e.target.checked)}
              disabled={submitting}
            />
            <span>특별 행사</span>
          </label>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => handleChange('is_active', e.target.checked)}
              disabled={submitting}
            />
            <span>활성화</span>
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => void handleSubmitEvent()}
              disabled={submitting}
              style={primaryButtonStyle}
            >
              {submitting ? '처리중...' : isEditing ? '이벤트 수정' : '이벤트 생성'}
            </button>

            {isEditing && (
              <button onClick={resetForm} disabled={submitting} style={secondaryButtonStyle}>
                수정 취소
              </button>
            )}

            <button
              onClick={() => void refreshEvents()}
              disabled={submitting}
              style={secondaryButtonStyle}
            >
              새로고침
            </button>
          </div>
        </div>
      </section>

      {error && <div style={errorBoxStyle}>{error}</div>}
      {success && <div style={successBoxStyle}>{success}</div>}

      <section style={{ display: 'grid', gap: 16 }}>
        <h3 style={{ margin: 0 }}>이벤트 목록</h3>

        {events.length === 0 ? (
          <div style={emptyBoxStyle}>등록된 이벤트가 없습니다.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={thStyle}>이름</th>
                  <th style={thStyle}>기본 시작 시간</th>
                  <th style={thStyle}>반복 규칙</th>
                  <th style={thStyle}>지각 기준</th>
                  <th style={thStyle}>특별 행사</th>
                  <th style={thStyle}>중복 허용</th>
                  <th style={thStyle}>활성화</th>
                  <th style={thStyle}>관리</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const days = normalizeRecurrenceDays(event.recurrence_days)

                  return (
                    <tr key={event.id}>
                      <td style={tdStyle}>{event.name}</td>
                      <td style={tdStyle}>{new Date(event.start_time).toLocaleString()}</td>
                      <td style={tdStyle}>{formatRecurrenceDays(days)}</td>
                      <td style={tdStyle}>{event.late_threshold_min}분</td>
                      <td style={tdStyle}>{event.is_special_event ? '예' : '아니오'}</td>
                      <td style={tdStyle}>{event.allow_duplicate_check ? '허용' : '불가'}</td>
                      <td style={tdStyle}>{event.is_active ? '활성' : '비활성'}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => startEditEvent(event)}
                            disabled={submitting}
                            style={secondaryButtonStyle}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => void handleDeleteEvent(event.id)}
                            disabled={submitting}
                            style={dangerButtonStyle}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
}

const inputStyle: React.CSSProperties = {
  height: 40,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid #ccc',
  fontSize: 14,
}

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
}

const primaryButtonStyle: React.CSSProperties = {
  height: 40,
  padding: '0 14px',
  borderRadius: 8,
  border: 'none',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
}

const secondaryButtonStyle: React.CSSProperties = {
  height: 40,
  padding: '0 14px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#111827',
  cursor: 'pointer',
  fontWeight: 600,
}

const dangerButtonStyle: React.CSSProperties = {
  height: 40,
  padding: '0 14px',
  borderRadius: 8,
  border: 'none',
  background: '#b91c1c',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff',
  border: '1px solid #ddd',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 14px',
  borderBottom: '1px solid #ddd',
  fontSize: 14,
}

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid #eee',
  fontSize: 14,
  verticalAlign: 'top',
}

const emptyBoxStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: 10,
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  color: '#6b7280',
}

const errorBoxStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: '#fff1f2',
  border: '1px solid #fecdd3',
  color: '#be123c',
}

const successBoxStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  color: '#166534',
}
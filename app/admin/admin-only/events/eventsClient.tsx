// app/admin/admin-only/events/eventsClient.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'

type EventItem = {
  id: string
  name: string
  start_time: string
  late_threshold_min: number
  allow_duplicate_check: boolean
  is_special_event: boolean
}

type QrItem = {
  id: string
  event_id: string
  token: string
  expires_at: string
  used_count: number
  created_at: string
  is_expired: boolean
}

type EventFormState = {
  name: string
  start_time: string
  late_threshold_min: string
  allow_duplicate_check: boolean
  is_special_event: boolean
}

type ExpireUnit = 'minutes' | 'days'

const initialForm: EventFormState = {
  name: '',
  start_time: toDateTimeLocalValue(new Date().toISOString()),
  late_threshold_min: '5',
  allow_duplicate_check: false,
  is_special_event: false,
}

export default function EventsClient() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [qrMap, setQrMap] = useState<Record<string, QrItem[]>>({})
  const [qrExpireUnitMap, setQrExpireUnitMap] = useState<
    Record<string, ExpireUnit>
  >({})
  const [qrExpireValueMap, setQrExpireValueMap] = useState<
    Record<string, string>
  >({})

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

  async function fetchQrByEvent(eventId: string) {
    const res = await fetch('/api/qr/list', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event_id: eventId }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'QR 조회 실패')
    }

    const qrTokens = Array.isArray(data.qr_tokens)
      ? (data.qr_tokens as QrItem[])
      : []

    setQrMap((prev) => ({
      ...prev,
      [eventId]: qrTokens,
    }))

    return qrTokens
  }

  async function refreshAll() {
    try {
      setLoading(true)
      setError('')

      const eventItems = await fetchEvents()
      setEvents(eventItems)

      await Promise.all(eventItems.map((event) => fetchQrByEvent(event.id)))
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 조회 중 오류 발생')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshAll()
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
    setForm((prev) => ({ ...prev, [key]: value 
      
    }))
  }

  function validateEventForm() {
    const name = form.name.trim()
    const startTime = form.start_time.trim()
    const lateThreshold = Number(form.late_threshold_min)

    if (!name) {
      return '이벤트 이름을 입력해주세요.'
    }

    if (!startTime) {
      return '시작 시간을 입력해주세요.'
    }

    if (Number.isNaN(new Date(startTime).getTime())) {
      return '시작 시간 형식이 올바르지 않습니다.'
    }

    if (
      !Number.isInteger(lateThreshold) ||
      lateThreshold < 0 ||
      lateThreshold > 180
    ) {
      return '지각 기준은 0~180 사이 정수여야 합니다.'
    }

    return ''
  }

  function validateQrExpireSetting(expireUnit: ExpireUnit, expireValue: number) {
    if (expireUnit === 'minutes') {
      if (
        !Number.isInteger(expireValue) ||
        expireValue < 10 ||
        expireValue % 10 !== 0
      ) {
        return '분 단위 QR 유효시간은 10분 단위 정수여야 합니다. (예: 10, 20, 30)'
      }
      return ''
    }

    if (!Number.isInteger(expireValue) || expireValue < 1 || expireValue > 30) {
      return '일 단위 QR 유효시간은 1~30일 사이 정수여야 합니다.'
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

      setSuccess(
        isEditing ? '이벤트가 수정되었습니다.' : '이벤트가 생성되었습니다.'
      )
      resetForm()
      await refreshAll()
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
    setForm({
      name: event.name,
      start_time: toDateTimeLocalValue(event.start_time),
      late_threshold_min: String(event.late_threshold_min ?? 5),
      allow_duplicate_check: Boolean(event.allow_duplicate_check),
      is_special_event: Boolean(event.is_special_event),
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

      if (editingId === id) {
        resetForm()
      }

      setSuccess('이벤트가 삭제되었습니다.')
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : '이벤트 삭제 중 오류 발생')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateQr(eventId: string) {
    const expireUnit = qrExpireUnitMap[eventId] ?? 'minutes'
    const expireValue = Number(
      qrExpireValueMap[eventId] ?? (expireUnit === 'minutes' ? '10' : '1')
    )

    const validationError = validateQrExpireSetting(expireUnit, expireValue)
    if (validationError) {
      setError(validationError)
      setSuccess('')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      const res = await fetch('/api/qr/create', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_id: eventId,
          expire_unit: expireUnit,
          expire_value: expireValue,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'QR 생성 실패')
      }

      setSuccess(
        data.message || 'QR이 생성되었습니다. 기존 활성 QR은 자동 만료 처리되었습니다.'
      )
      await fetchQrByEvent(eventId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR 생성 중 오류 발생')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdateQr(qrId: string, eventId: string) {
    const expireUnit = qrExpireUnitMap[eventId] ?? 'minutes'
    const expireValue = Number(
      qrExpireValueMap[eventId] ?? (expireUnit === 'minutes' ? '10' : '1')
    )

    const validationError = validateQrExpireSetting(expireUnit, expireValue)
    if (validationError) {
      setError(validationError)
      setSuccess('')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      const res = await fetch('/api/qr/update', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: qrId,
          expire_unit: expireUnit,
          expire_value: expireValue,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'QR 수정 실패')
      }

      setSuccess(data.message || 'QR 유효 시간이 수정되었습니다.')
      await fetchQrByEvent(eventId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR 수정 중 오류 발생')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteQr(qrId: string, eventId: string) {
    const confirmed = window.confirm('정말 이 QR을 삭제하시겠습니까?')
    if (!confirmed) return

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      const res = await fetch('/api/qr/delete', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: qrId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'QR 삭제 실패')
      }

      setSuccess(data.message || 'QR이 삭제되었습니다.')
      await fetchQrByEvent(eventId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR 삭제 중 오류 발생')
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
        <h2 style={{ marginBottom: 8 }}>이벤트 / QR 관리</h2>
        <p style={{ color: '#666', margin: 0 }}>
          관리자 전용 이벤트 생성, 수정, 삭제 및 이벤트별 QR 관리 화면입니다.
        </p>
      </div>

      <section style={panelStyle}>
        <h3 style={{ marginTop: 0 }}>
          {isEditing ? '이벤트 수정' : '이벤트 생성'}
        </h3>

        <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>이벤트 이름</span>
            <input
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="예: 수요 워크숍"
              style={inputStyle}
              disabled={submitting}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>시작 시간</span>
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
              onChange={(e) =>
                handleChange('late_threshold_min', e.target.value)
              }
              style={inputStyle}
              disabled={submitting}
            />
          </label>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={form.allow_duplicate_check}
              onChange={(e) =>
                handleChange('allow_duplicate_check', e.target.checked)
              }
              disabled={submitting}
            />
            <span>중복 출석 허용</span>
          </label>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={form.is_special_event}
              onChange={(e) =>
                handleChange('is_special_event', e.target.checked)
              }
              disabled={submitting}
            />
            <span>특별 행사</span>
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => void handleSubmitEvent()}
              disabled={submitting}
              style={primaryButtonStyle}
            >
              {submitting
                ? '처리중...'
                : isEditing
                ? '이벤트 수정'
                : '이벤트 생성'}
            </button>

            {isEditing && (
              <button
                onClick={resetForm}
                disabled={submitting}
                style={secondaryButtonStyle}
              >
                수정 취소
              </button>
            )}

            <button
              onClick={() => void refreshAll()}
              disabled={submitting}
              style={secondaryButtonStyle}
            >
              전체 새로고침
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
          events.map((event) => {
            const qrs = qrMap[event.id] ?? []
            const qrExpireUnit = qrExpireUnitMap[event.id] ?? 'minutes'
            const qrExpireValue =
              qrExpireValueMap[event.id] ??
              (qrExpireUnit === 'minutes' ? '10' : '1')

            return (
              <article key={event.id} style={panelStyle}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>
                      {event.name}
                    </div>
                    <div style={{ color: '#666', marginTop: 6 }}>
                      시작 시간: {new Date(event.start_time).toLocaleString()}
                    </div>
                    <div style={{ color: '#666', marginTop: 4 }}>
                      지각 기준: {event.late_threshold_min}분 / 중복 출석:{' '}
                      {event.allow_duplicate_check ? '허용' : '불가'} / 특별 행사:{' '}
                      {event.is_special_event ? '예' : '아니오'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => startEditEvent(event)}
                      disabled={submitting}
                      style={secondaryButtonStyle}
                    >
                      이벤트 수정
                    </button>
                    <button
                      onClick={() => void handleDeleteEvent(event.id)}
                      disabled={submitting}
                      style={dangerButtonStyle}
                    >
                      이벤트 삭제
                    </button>
                  </div>
                </div>

                <div style={qrPanelStyle}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                      marginBottom: 12,
                    }}
                  >
                    <h4 style={{ margin: 0 }}>QR 관리</h4>

                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      <select
                        value={qrExpireUnit}
                        onChange={(e) => {
                          const nextUnit = e.target.value as ExpireUnit
                          setQrExpireUnitMap((prev) => ({
                            ...prev,
                            [event.id]: nextUnit,
                          }))
                          setQrExpireValueMap((prev) => ({
                            ...prev,
                            [event.id]: nextUnit === 'minutes' ? '10' : '1',
                          }))
                        }}
                        style={{ ...inputStyle, width: 140 }}
                        disabled={submitting}
                      >
                        <option value="minutes">10분 단위</option>
                        <option value="days">일 단위</option>
                      </select>

                      <input
                        type="number"
                        min={qrExpireUnit === 'minutes' ? 10 : 1}
                        step={qrExpireUnit === 'minutes' ? 10 : 1}
                        value={qrExpireValue}
                        onChange={(e) =>
                          setQrExpireValueMap((prev) => ({
                            ...prev,
                            [event.id]: e.target.value,
                          }))
                        }
                        style={{ ...inputStyle, width: 120 }}
                        disabled={submitting}
                      />

                      <span style={{ color: '#666' }}>
                        {qrExpireUnit === 'minutes' ? '분' : '일'}
                      </span>

                      <button
                        onClick={() => void handleCreateQr(event.id)}
                        disabled={submitting}
                        style={primaryButtonStyle}
                      >
                        QR 생성
                      </button>
                    </div>
                  </div>

                  {qrs.length === 0 ? (
                    <div style={emptyBoxStyle}>생성된 QR이 없습니다.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={tableStyle}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={thStyle}>토큰</th>
                            <th style={thStyle}>만료 시각</th>
                            <th style={thStyle}>상태</th>
                            <th style={thStyle}>사용 횟수</th>
                            <th style={thStyle}>관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {qrs.map((qr) => (
                            <tr key={qr.id}>
                              <td style={tdStyle}>
                                <code style={codeStyle}>{qr.token}</code>
                              </td>
                              <td style={tdStyle}>
                                {new Date(qr.expires_at).toLocaleString()}
                              </td>
                              <td style={tdStyle}>
                                {qr.is_expired ? '만료됨' : '유효'}
                              </td>
                              <td style={tdStyle}>{qr.used_count}</td>
                              <td style={tdStyle}>
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: 8,
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <button
                                    onClick={() =>
                                      void handleUpdateQr(qr.id, event.id)
                                    }
                                    disabled={submitting}
                                    style={secondaryButtonStyle}
                                  >
                                    QR 재발급
                                  </button>
                                  <button
                                    onClick={() =>
                                      void handleDeleteQr(qr.id, event.id)
                                    }
                                    disabled={submitting}
                                    style={dangerButtonStyle}
                                  >
                                    QR 삭제
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </article>
            )
          })
        )}
      </section>
    </div>
  )
}

function toDateTimeLocalValue(isoString: string) {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''

  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

const panelStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
}

const qrPanelStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 14,
  borderRadius: 10,
  background: '#f8fafc',
  border: '1px solid #e5e7eb',
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

const codeStyle: React.CSSProperties = {
  display: 'inline-block',
  maxWidth: 260,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
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
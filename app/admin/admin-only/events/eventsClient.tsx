'use client'

import { useEffect, useState } from 'react'

// ==========================================
// 1. 타입 및 상수 정의
// ==========================================
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
  { label: '일', value: 'sun' },
  { label: '월', value: 'mon' },
  { label: '화', value: 'tue' },
  { label: '수', value: 'wed' },
  { label: '목', value: 'thu' },
  { label: '금', value: 'fri' },
  { label: '토', value: 'sat' },
]

const WEEKDAY_ORDER: Record<WeekdayCode, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
}

// ==========================================
// 2. 유틸리티 함수 (Timezone 버그 수정)
// ==========================================
function toDateTimeLocalValue(isoString: string): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''

  // 현지 시간 기준의 연-월-일 시:분 추출 (타임존 왜곡 방지)
  const pad = (num: number) => String(num).padStart(2, '0')
  const YYYY = date.getFullYear()
  const MM = pad(date.getMonth() + 1)
  const DD = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())

  return `${YYYY}-${MM}-${DD}T${hh}:${mm}`
}

function normalizeRecurrenceDays(days: unknown): WeekdayCode[] {
  if (!Array.isArray(days)) return []
  
  const validDays = days.filter((d): d is WeekdayCode => 
    typeof d === 'string' && d.trim() in WEEKDAY_ORDER
  )
  
  // 중복 제거 및 요일 순서대로 정렬
  return Array.from(new Set(validDays)).sort(
    (a, b) => WEEKDAY_ORDER[a] - WEEKDAY_ORDER[b]
  )
}

function formatRecurrenceDays(days: WeekdayCode[] | null | undefined): string {
  const normalizedDays = normalizeRecurrenceDays(days)
  if (normalizedDays.length === 0) return '반복 없음'

  const labelMap: Record<WeekdayCode, string> = {
    sun: '일', mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토'
  }

  return normalizedDays.map((day) => labelMap[day]).join(', ')
}

// ==========================================
// 3. 메인 컴포넌트
// ==========================================
export default function EventsClient() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState<EventFormState>({
    name: '',
    start_time: toDateTimeLocalValue(new Date().toISOString()),
    late_threshold_min: '5',
    allow_duplicate_check: false,
    is_special_event: false,
    recurrence_type: 'none',
    recurrence_days: [],
    is_active: true,
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  // useMemo 불필요 제거 -> 원시 값 비교로 성능 향상
  const isEditing = editingId !== null

  useEffect(() => {
    void refreshEvents()
  }, [])

  async function fetchEvents(): Promise<EventItem[]> {
    const res = await fetch('/api/events/list', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '행사 조회 실패')
    return Array.isArray(data.items) ? (data.items as EventItem[]) : []
  }

  async function refreshEvents() {
    try {
      setLoading(true)
      setError('')
      const eventItems = await fetchEvents()
      setEvents(eventItems)
    } catch (err) {
      setError(err instanceof Error ? err.message : '행사 조회 중 오류 발생')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({
      name: '',
      start_time: toDateTimeLocalValue(new Date().toISOString()),
      late_threshold_min: '5',
      allow_duplicate_check: false,
      is_special_event: false,
      recurrence_type: 'none',
      recurrence_days: [],
      is_active: true,
    })
    setEditingId(null)
  }

  function handleChange<K extends keyof EventFormState>(key: K, value: EventFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleRecurrenceDay(day: WeekdayCode) {
    setForm((prev) => {
      const isExist = prev.recurrence_days.includes(day)
      const nextDays = isExist
        ? prev.recurrence_days.filter((item) => item !== day)
        : [...prev.recurrence_days, day]

      const sortedDays = nextDays.sort((a, b) => WEEKDAY_ORDER[a] - WEEKDAY_ORDER[b])

      return {
        ...prev,
        recurrence_days: sortedDays,
        recurrence_type: sortedDays.length > 0 ? 'daily' : 'none',
      }
    })
  }

  function validateEventForm(): string {
    const name = form.name.trim()
    const startTime = form.start_time.trim()
    const lateThreshold = Number(form.late_threshold_min)

    if (!name) return '행사 이름을 입력해주세요.'
    if (!startTime) return '시작 시간을 입력해주세요.'
    if (Number.isNaN(new Date(startTime).getTime())) return '시작 시간 형식이 올바르지 않습니다.'
    if (!Number.isInteger(lateThreshold) || lateThreshold < 0 || lateThreshold > 180) {
      return '지각 기준은 0~180 사이 정수여야 합니다.'
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || (isEditing ? '행사 수정 실패' : '행사 생성 실패'))

      setSuccess(isEditing ? '행사가 수정되었습니다.' : '행사가 생성되었습니다.')
      resetForm()
      await refreshEvents()
    } catch (err) {
      setError(err instanceof Error ? err.message : isEditing ? '행사 수정 중 오류 발생' : '행사 생성 중 오류 발생')
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
    if (!window.confirm('정말 이 행사를 삭제하시겠습니까?')) return

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      const res = await fetch('/api/events/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '행사 삭제 실패')

      if (editingId === id) resetForm()
      setSuccess('행사가 삭제되었습니다.')
      await refreshEvents()
    } catch (err) {
      setError(err instanceof Error ? err.message : '행사 삭제 중 오류 발생')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div style={{ padding: 20 }}>로딩중...</div>

  return (
    <div style={containerStyle}>
      <div>
        <h2 style={{ marginBottom: 8 }}>행사 관리</h2>
        <p style={{ color: '#666', margin: 0 }}>
          관리자 전용 행사 설정 화면입니다. 반복 규칙과 기본 속성을 관리합니다.
        </p>
      </div>

      {/* 대시보드 폼 섹션 */}
      <section style={panelStyle}>
        <h3 style={{ marginTop: 0 }}>{isEditing ? '행사 수정' : '행사 생성'}</h3>
        <div style={formLayoutStyle}>
          <label style={fieldLabelStyle}>
            <span>행사 이름</span>
            <input
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="예: 집중기도회"
              style={inputStyle}
              disabled={submitting}
            />
          </label>

          <label style={fieldLabelStyle}>
            <span>기본 시작 시간</span>
            <input
              type="datetime-local"
              value={form.start_time}
              onChange={(e) => handleChange('start_time', e.target.value)}
              style={inputStyle}
              disabled={submitting}
            />
          </label>

          <label style={fieldLabelStyle}>
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

          {/* 반복 요일 선택 */}
          <div style={fieldLabelStyle}>
            <span>반복 요일</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {WEEKDAY_OPTIONS.map((option) => {
                const isChecked = form.recurrence_days.includes(option.value)
                return (
                  <label
                    key={option.value}
                    style={{
                      ...weekdayBadgeStyle,
                      background: isChecked ? '#eff6ff' : '#fff',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleRecurrenceDay(option.value)}
                      disabled={submitting}
                    />
                    <span>{option.label}</span>
                  </label>
                )
              })}
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>
              {form.recurrence_days.length > 0
                ? `선택된 요일: ${formatRecurrenceDays(form.recurrence_days)}`
                : '반복 없음'}
            </div>
          </div>

          {/* 체크박스 옵션들 */}
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

          {/* 하단 버튼 제어 구조 */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => void handleSubmitEvent()} disabled={submitting} style={primaryButtonStyle}>
              {submitting ? '처리중...' : isEditing ? '행사 수정' : '행사 생성'}
            </button>
            {isEditing && (
              <button onClick={resetForm} disabled={submitting} style={secondaryButtonStyle}>
                수정 취소
              </button>
            )}
            <button onClick={() => void refreshEvents()} disabled={submitting} style={secondaryButtonStyle}>
              새로고침
            </button>
          </div>
        </div>
      </section>

      {error && <div style={errorBoxStyle}>{error}</div>}
      {success && <div style={successBoxStyle}>{success}</div>}

      {/* 리스트 테이블 섹션 */}
      <section style={{ display: 'grid', gap: 16 }}>
        <h3 style={{ margin: 0 }}>행사 목록</h3>
        {events.length === 0 ? (
          <div style={emptyBoxStyle}>등록된 행사가 없습니다.</div>
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
                {events.map((event) => (
                  <tr key={event.id}>
                    <td style={tdStyle}>{event.name}</td>
                    <td style={tdStyle}>{new Date(event.start_time).toLocaleString()}</td>
                    <td style={tdStyle}>{formatRecurrenceDays(event.recurrence_days)}</td>
                    <td style={tdStyle}>{event.late_threshold_min}분</td>
                    <td style={tdStyle}>{event.is_special_event ? '예' : '아니오'}</td>
                    <td style={tdStyle}>{event.allow_duplicate_check ? '허용' : '불가'}</td>
                    <td style={tdStyle}>{event.is_active ? '활성' : '비활성'}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button onClick={() => startEditEvent(event)} disabled={submitting} style={secondaryButtonStyle}>
                          수정
                        </button>
                        <button onClick={() => void handleDeleteEvent(event.id)} disabled={submitting} style={dangerButtonStyle}>
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// ==========================================
// 4. 스타일 정의 개체
// ==========================================
const containerStyle: React.CSSProperties = {
  padding: 20,
  display: 'grid',
  gap: 24,
}

const formLayoutStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  maxWidth: 560,
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
}

const weekdayBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
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
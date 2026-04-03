'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { fetchSessionUser, hasRole } from '@/lib/auth'

type StoredUser = {
  id: string
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
}

type EventType = 'normal' | 'special'

type EventItem = {
  id: string
  name: string
  type: EventType
  start_time: string
  late_threshold_min: number
  allow_duplicate: boolean
  created_at?: string
}

type QrItem = {
  id: string
  event_id: string
  token: string
  expires_at: string
  used_count: number
  created_at?: string
  created_by?: string
  events?: {
    id: string
    name: string
    start_time: string
  } | null
}

type FormMode = 'create' | 'edit'

const INITIAL_FORM = {
  name: '',
  type: 'normal' as EventType,
  startDate: '',
  startTime: '',
  lateThresholdMin: '10',
  allowDuplicate: false,
}

export default function AdminEventsPage() {
  const router = useRouter()

  const [actor, setActor] = useState<StoredUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null)

  const [events, setEvents] = useState<EventItem[]>([])
  const [qrTokens, setQrTokens] = useState<QrItem[]>([])
  const [qrCreateLoadingId, setQrCreateLoadingId] = useState<string | null>(null)
  const [qrDeleteLoadingId, setQrDeleteLoadingId] = useState<string | null>(null)

  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [keyword, setKeyword] = useState('')

  const [mode, setMode] = useState<FormMode>('create')
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [form, setForm] = useState(INITIAL_FORM)

  useEffect(() => {
    const loadUser = async () => {
      const savedUser = (await fetchSessionUser()) as StoredUser | null

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

      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const hh = String(now.getHours()).padStart(2, '0')
      const mi = String(now.getMinutes()).padStart(2, '0')

      setForm((prev) => ({
        ...prev,
        startDate: `${yyyy}-${mm}-${dd}`,
        startTime: `${hh}:${mi}`,
      }))

      setLoading(false)
    }

    loadUser()
  }, [router])

  useEffect(() => {
    if (!actor) return
    void refreshAll()
  }, [actor])

  const filteredEvents = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return events

    return events.filter((event) => {
      const value = [
        event.name,
        event.type,
        event.start_time,
        String(event.late_threshold_min),
        event.allow_duplicate ? '중복허용' : '중복불가',
      ]
        .join(' ')
        .toLowerCase()

      return value.includes(q)
    })
  }, [events, keyword])

  const qrMap = useMemo(() => {
    const grouped = new Map<string, QrItem[]>()

    for (const qr of qrTokens) {
      const prev = grouped.get(qr.event_id) ?? []
      prev.push(qr)
      grouped.set(qr.event_id, prev)
    }

    return grouped
  }, [qrTokens])

  const fetchEvents = async () => {
    const response = await fetch('/api/events/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || '이벤트 목록 조회에 실패했습니다.')
    }

    setEvents(result.events ?? [])
  }

  const fetchQrTokens = async () => {
    const response = await fetch('/api/qr/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'QR 목록 조회에 실패했습니다.')
    }

    setQrTokens(result.qrTokens ?? [])
  }

  const refreshAll = async () => {
    try {
      setListLoading(true)
      setErrorMessage('')

      await Promise.all([fetchEvents(), fetchQrTokens()])
    } catch (error) {
      console.error(error)
      setErrorMessage(
        error instanceof Error ? error.message : '데이터 조회 중 오류가 발생했습니다.'
      )
    } finally {
      setListLoading(false)
    }
  }

  const buildStartTime = () => {
    if (!form.startDate || !form.startTime) return ''
    return `${form.startDate}T${form.startTime}:00`
  }

  const resetForm = () => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mi = String(now.getMinutes()).padStart(2, '0')

    setForm({
      ...INITIAL_FORM,
      startDate: `${yyyy}-${mm}-${dd}`,
      startTime: `${hh}:${mi}`,
    })
    setMode('create')
    setEditingEventId(null)
  }

  const handleChange = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleEdit = (event: EventItem) => {
    const localDate = new Date(event.start_time)
    const yyyy = localDate.getFullYear()
    const mm = String(localDate.getMonth() + 1).padStart(2, '0')
    const dd = String(localDate.getDate()).padStart(2, '0')
    const hh = String(localDate.getHours()).padStart(2, '0')
    const mi = String(localDate.getMinutes()).padStart(2, '0')

    setMode('edit')
    setEditingEventId(event.id)
    setMessage('')
    setErrorMessage('')
    setForm({
      name: event.name,
      type: event.type,
      startDate: `${yyyy}-${mm}-${dd}`,
      startTime: `${hh}:${mi}`,
      lateThresholdMin: String(event.late_threshold_min),
      allowDuplicate: event.allow_duplicate,
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async () => {
    try {
      setSubmitLoading(true)
      setErrorMessage('')
      setMessage('')

      if (!form.name.trim()) {
        setErrorMessage('이벤트명을 입력해주세요.')
        return
      }

      if (!form.startDate || !form.startTime) {
        setErrorMessage('시작 날짜와 시간을 입력해주세요.')
        return
      }

      const lateThreshold = Number(form.lateThresholdMin)
      if (Number.isNaN(lateThreshold) || lateThreshold < 0) {
        setErrorMessage('지각 기준(분)은 0 이상의 숫자여야 합니다.')
        return
      }

      const payload = {
        id: editingEventId,
        name: form.name.trim(),
        type: form.type,
        start_time: buildStartTime(),
        late_threshold_min: lateThreshold,
        allow_duplicate: form.allowDuplicate,
      }

      const endpoint =
        mode === 'create' ? '/api/events/create' : '/api/events/update'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        setErrorMessage(result.error || '이벤트 저장에 실패했습니다.')
        return
      }

      setMessage(
        mode === 'create'
          ? '이벤트가 생성되었습니다.'
          : '이벤트가 수정되었습니다.'
      )

      resetForm()
      await refreshAll()
    } catch (error) {
      console.error(error)
      setErrorMessage('이벤트 저장 중 오류가 발생했습니다.')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDelete = async (event: EventItem) => {
    const ok = window.confirm(
      `정말 "${event.name}" 이벤트를 삭제하시겠습니까?\n이미 출석 기록이 있거나 QR이 연결되어 있으면 삭제할 수 없습니다.`
    )

    if (!ok) return

    try {
      setDeleteLoadingId(event.id)
      setErrorMessage('')
      setMessage('')

      const response = await fetch('/api/events/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: event.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        setErrorMessage(result.error || '이벤트 삭제에 실패했습니다.')
        return
      }

      setMessage('이벤트가 삭제되었습니다.')

      if (editingEventId === event.id) {
        resetForm()
      }

      await refreshAll()
    } catch (error) {
      console.error(error)
      setErrorMessage('이벤트 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeleteLoadingId(null)
    }
  }

  const handleCreateQr = async (event: EventItem) => {
    try {
      setQrCreateLoadingId(event.id)
      setErrorMessage('')
      setMessage('')

      const response = await fetch('/api/qr/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          expire_minutes: 60,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setErrorMessage(result.error || 'QR 생성에 실패했습니다.')
        return
      }

      setMessage(`"${event.name}" QR 코드가 생성되었습니다.`)
      await fetchQrTokens()
    } catch (error) {
      console.error(error)
      setErrorMessage('QR 생성 중 오류가 발생했습니다.')
    } finally {
      setQrCreateLoadingId(null)
    }
  }

  const handleDeleteQr = async (qr: QrItem) => {
    const ok = window.confirm('정말 이 QR 코드를 삭제하시겠습니까?')
    if (!ok) return

    try {
      setQrDeleteLoadingId(qr.id)
      setErrorMessage('')
      setMessage('')

      const response = await fetch('/api/qr/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: qr.id }),
      })
      const contentType = response.headers.get('content-type') || ''
      //프론트에서 response.json()은 안전하게 처리.
      const result = 
      contentType.includes('application/json')
        ? await response.json()
        : null



      if (!response.ok) {
        setErrorMessage(result.error || 'QR 삭제에 실패했습니다.')
        return
      }

      setMessage('QR 코드가 삭제되었습니다.')
      await fetchQrTokens()
    } catch (error) {
      console.error(error)
      setErrorMessage('QR 삭제 중 오류가 발생했습니다.')
    } finally {
      setQrDeleteLoadingId(null)
    }
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

  const buildScanUrl = (token: string) => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/attendance/scan?token=${encodeURIComponent(token)}`
  }

  if (loading || !actor) {
    return <div style={{ padding: '20px' }}>로딩중...</div>
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h2>이벤트 관리</h2>

      <p style={{ marginBottom: '20px' }}>
        관리자: {actor.full_name} ({actor.student_id})
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '12px',
            padding: '16px',
            background: '#fff',
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            {mode === 'create' ? '이벤트 생성' : '이벤트 수정'}
          </h3>

          <label style={{ display: 'block', marginBottom: '6px' }}>이벤트명</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="예: 수요 워크숍"
            style={{ width: '100%', padding: '10px', marginBottom: '12px', boxSizing: 'border-box' }}
          />

          <label style={{ display: 'block', marginBottom: '6px' }}>이벤트 타입</label>
          <select
            value={form.type}
            onChange={(e) => handleChange('type', e.target.value as EventType)}
            style={{ width: '100%', padding: '10px', marginBottom: '12px', boxSizing: 'border-box' }}
          >
            <option value="normal">normal</option>
            <option value="special">special</option>
          </select>

          <label style={{ display: 'block', marginBottom: '6px' }}>시작 날짜</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '12px', boxSizing: 'border-box' }}
          />

          <label style={{ display: 'block', marginBottom: '6px' }}>시작 시간</label>
          <input
            type="time"
            value={form.startTime}
            onChange={(e) => handleChange('startTime', e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '12px', boxSizing: 'border-box' }}
          />

          <label style={{ display: 'block', marginBottom: '6px' }}>지각 기준(분)</label>
          <input
            type="number"
            min="0"
            value={form.lateThresholdMin}
            onChange={(e) => handleChange('lateThresholdMin', e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '12px', boxSizing: 'border-box' }}
          />

          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
            <input
              type="checkbox"
              checked={form.allowDuplicate}
              onChange={(e) => handleChange('allowDuplicate', e.target.checked)}
            />
            중복 출석 허용
          </label>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={handleSubmit} disabled={submitLoading}>
              {submitLoading
                ? mode === 'create'
                  ? '생성중...'
                  : '수정중...'
                : mode === 'create'
                  ? '이벤트 생성'
                  : '이벤트 수정'}
            </button>

            {mode === 'edit' && (
              <button onClick={resetForm} type="button">
                수정 취소
              </button>
            )}

            <button onClick={() => router.push('/admin')}>관리자 페이지로</button>
            <button onClick={() => router.push('/')}>메인으로</button>
          </div>

          {message && (
            <p style={{ color: 'green', marginTop: '16px' }}>✅ {message}</p>
          )}

          {errorMessage && (
            <p style={{ color: 'crimson', marginTop: '16px' }}>⚠️ {errorMessage}</p>
          )}
        </div>

        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '12px',
            padding: '16px',
            background: '#fff',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: '12px',
            }}
          >
            <h3 style={{ margin: 0 }}>이벤트 + QR 관리</h3>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="이벤트명 검색"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{ padding: '8px 10px', minWidth: '220px' }}
              />
              <button onClick={refreshAll} disabled={listLoading}>
                {listLoading ? '불러오는 중...' : '새로고침'}
              </button>
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <p style={{ color: '#666' }}>등록된 이벤트가 없습니다.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: '1100px',
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>이벤트명</th>
                    <th style={thStyle}>타입</th>
                    <th style={thStyle}>시작 시간</th>
                    <th style={thStyle}>지각 기준</th>
                    <th style={thStyle}>중복 허용</th>
                    <th style={thStyle}>이벤트 관리</th>
                    <th style={thStyle}>QR 관리</th>
                    
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => {
                    const eventQrList = qrMap.get(event.id) ?? []

                    return (
                      <tr key={event.id}>
                        <td style={tdStyle}>{event.name}</td>
                        <td style={tdStyle}>{event.type}</td>
                        <td style={tdStyle}>{formatDateTime(event.start_time)}</td>
                        <td style={tdStyle}>{event.late_threshold_min}분</td>
                        <td style={tdStyle}>{event.allow_duplicate ? '허용' : '불가'}</td>

                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button onClick={() => handleEdit(event)}>수정</button>
                            <button
                              onClick={() => handleDelete(event)}
                              disabled={deleteLoadingId === event.id}>
                              {deleteLoadingId === event.id ? '삭제중...' : '삭제'}
                            </button>
                          </div>
                        </td>

                        <td style={tdStyle}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button
                              onClick={() => handleCreateQr(event)}
                              disabled={qrCreateLoadingId === event.id}
                            >
                              {qrCreateLoadingId === event.id ? '생성중...' : 'QR 생성'}
                            </button>


                            {eventQrList.length === 0 ? (
                              <span style={{ color: '#666', fontSize: '14px' }}>
                                생성된 QR 없음
                              </span>
                            ) : (
                              eventQrList.map((qr) => (
                                <EventQrCard
                                  key={qr.id}
                                  qr={qr}
                                  scanUrl={buildScanUrl(qr.token)}
                                  formatDateTime={formatDateTime}
                                  deleting={qrDeleteLoadingId === qr.id}
                                  onDelete={() => handleDeleteQr(qr)}
                                />
                              ))
                            )}
                          </div>
                        </td>

                        
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EventQrCard({
  qr,
  scanUrl,
  formatDateTime,
  deleting,
  onDelete,
}: {
  qr: QrItem
  scanUrl: string
  formatDateTime: (value: string) => string
  deleting: boolean
  onDelete: () => void
}) {
  const [qrImageUrl, setQrImageUrl] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const router = useRouter()
  useEffect(() => {
    let mounted = true

    const generate = async () => {
      try {
        if (!scanUrl) return
        const dataUrl = await QRCode.toDataURL(scanUrl, {
          width: 140,
          margin: 2,
        })

        if (mounted) {
          setQrImageUrl(dataUrl)
        }
      } catch (error) {
        console.error(error)
      }
    }

    void generate()

    return () => {
      mounted = false
    }
  }, [scanUrl])

  const isExpired = new Date(qr.expires_at).getTime() < Date.now()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(scanUrl)
      setActionMessage('링크가 복사되었습니다.')
    } catch (error) {
      console.error(error)
      setActionMessage('링크 복사에 실패했습니다.')
    }
  }

  const handleOpenQrPage = () => {
  if (!scanUrl) return

  const url = `/admin/qr/view?url=${encodeURIComponent(scanUrl)}&qrId=${encodeURIComponent(qr.id)}&fullscreen=1`

  // 새 창에서 열기
  const opened = window.open(url, '_blank', 'noopener,noreferrer')

  if (!opened) {
    setActionMessage('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.')
  }
  }

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '12px',
        background: '#fafafa',
        minWidth: '260px',
      }}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div
          style={{
            width: '140px',
            height: '140px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {qrImageUrl ? (
            <img
              src={qrImageUrl}
              alt="QR Code"
              style={{ width: '140px', height: '140px' }}
            />
          ) : (
            <span style={{ fontSize: '12px', color: '#666' }}>QR 생성중...</span>
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ marginBottom: '6px', fontWeight: 600 }}>
            {isExpired ? '만료됨' : '사용 가능'}
          </div>
          <div style={{ fontSize: '13px', color: '#444', marginBottom: '4px' }}>
            만료: {formatDateTime(qr.expires_at)}
          </div>
          <div style={{ fontSize: '13px', color: '#444', marginBottom: '8px' }}>
            사용 횟수: {qr.used_count ?? 0}
          </div>

          <div
            style={{
              fontSize: '12px',
              color: '#666',
              wordBreak: 'break-all',
              marginBottom: '10px',
            }}
          >
            {scanUrl}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button type="button" onClick={handleOpenQrPage}>
              QR 크게 보기
            </button>
            <button type="button" onClick={handleCopy}>
              링크 복사
            </button>
            <button type="button" onClick={onDelete} disabled={deleting}>
              {deleting ? '삭제중...' : '삭제'}
            </button>
          </div>

          {actionMessage && (
            <p style={{ marginTop: '8px', fontSize: '12px', color: '#0f766e' }}>
              {actionMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  borderBottom: '1px solid #ddd',
  padding: '10px',
  background: '#fafafa',
  verticalAlign: 'top',
}

const tdStyle: React.CSSProperties = {
  borderBottom: '1px solid #eee',
  padding: '10px',
  verticalAlign: 'top',
}
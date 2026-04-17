// app/admin/admin_only/logs/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminHeader from '@/components/admin/AdminHeader'

type LogAction = 'create' | 'update' | 'correct' | 'mark_absent' | 'delete'

type AttendanceLogItem = {
  id: string
  attendance_id: string | null
  changed_by: string | null
  target_user_id: string
  event_id: string
  date: string
  action: LogAction
  reason: string | null
  before_value: Record<string, unknown>
  after_value: Record<string, unknown>
  changed_at: string
}

type LogsResponse = {
  items?: AttendanceLogItem[]
  error?: string
}

const ACTION_OPTIONS: Array<{ value: '' | LogAction; label: string }> = [
  { value: '', label: '전체' },
  { value: 'create', label: '생성' },
  { value: 'update', label: '수정' },
  { value: 'correct', label: '정정' },
  { value: 'mark_absent', label: '결석 처리' },
  { value: 'delete', label: '삭제' },
]

function formatDateTimeKst(value: string | null | undefined): string {
  if (!value) return '-'

  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(value))
  } catch {
    return value
  }
}

function formatAction(action: LogAction): string {
  switch (action) {
    case 'create':
      return '생성'
    case 'update':
      return '수정'
    case 'correct':
      return '정정'
    case 'mark_absent':
      return '결석 처리'
    case 'delete':
      return '삭제'
    default:
      return action
  }
}

function prettyJson(value: Record<string, unknown> | null | undefined): string {
  if (!value || typeof value !== 'object') return '{}'

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '{}'
  }
}

export default function AdminLogsPage() {
  const [items, setItems] = useState<AttendanceLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [eventId, setEventId] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [changedBy, setChangedBy] = useState('')
  const [action, setAction] = useState<'' | LogAction>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()

    if (eventId.trim()) params.set('event_id', eventId.trim())
    if (targetUserId.trim()) params.set('target_user_id', targetUserId.trim())
    if (changedBy.trim()) params.set('changed_by', changedBy.trim())
    if (action) params.set('action', action)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)

    return params.toString()
  }, [eventId, targetUserId, changedBy, action, dateFrom, dateTo])

  async function fetchLogs(isInitial = false) {
    try {
      if (isInitial) {
        setLoading(true)
      } else {
        setSearchLoading(true)
      }

      setErrorMessage('')

      const response = await fetch(
        `/api/logs${queryString ? `?${queryString}` : ''}`,
        {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        }
      )

      const text = await response.text()
      const result: LogsResponse = text ? JSON.parse(text) : {}

      if (!response.ok) {
        setErrorMessage(result?.error || '로그를 불러오지 못했습니다.')
        setItems([])
        return
      }

      setItems(result?.items ?? [])
    } catch (error) {
      console.error('[admin/logs] fetch error:', error)
      setErrorMessage('로그 조회 중 오류가 발생했습니다.')
      setItems([])
    } finally {
      if (isInitial) {
        setLoading(false)
      } else {
        setSearchLoading(false)
      }
    }
  }

  useEffect(() => {
    void fetchLogs(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearch() {
    void fetchLogs(false)
  }

  function handleReset() {
    setEventId('')
    setTargetUserId('')
    setChangedBy('')
    setAction('')
    setDateFrom('')
    setDateTo('')

    setTimeout(() => {
      void fetchLogs(false)
    }, 0)
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>출석 로그를 불러오는 중입니다...</div>
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <AdminHeader
        title="출석 로그"
        description="출석 수정 및 정정 이력을 조회하고 변경 전/후 값을 확인할 수 있습니다."
      />

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '12px',
          background: '#fff',
          padding: '16px',
          marginBottom: '20px',
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: '18px' }}>필터</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>행사 ID</label>
            <input
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder="event_id"
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>대상 사용자 ID</label>
            <input
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="target_user_id"
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>수정자 ID</label>
            <input
              value={changedBy}
              onChange={(e) => setChangedBy(e.target.value)}
              placeholder="changed_by"
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>액션</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as '' | LogAction)}
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>날짜 시작</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>날짜 끝</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleSearch} disabled={searchLoading}>
            {searchLoading ? '조회 중...' : '조회'}
          </button>
          <button type="button" onClick={handleReset} disabled={searchLoading}>
            초기화
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px',
            borderRadius: '8px',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#be123c',
          }}
        >
          {errorMessage}
        </div>
      )}

      <div style={{ marginBottom: '12px', color: '#555' }}>
        총 <strong>{items.length}</strong>건
      </div>

      {items.length === 0 ? (
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '12px',
            background: '#fff',
            padding: '24px',
          }}
        >
          조회된 로그가 없습니다.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '12px',
                background: '#fff',
                padding: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                  marginBottom: '12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px' }}>
                    {formatAction(item.action)}
                  </div>
                  <div style={{ color: '#666', marginTop: '4px' }}>
                    변경 시각: {formatDateTimeKst(item.changed_at)}
                  </div>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '999px',
                    padding: '6px 12px',
                    fontSize: '13px',
                    height: 'fit-content',
                  }}
                >
                  날짜: {item.date}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '12px',
                  marginBottom: '12px',
                }}
              >
                <div>
                  <strong>대상 사용자 ID</strong>
                  <div style={{ marginTop: '4px', wordBreak: 'break-all' }}>
                    {item.target_user_id}
                  </div>
                </div>

                <div>
                  <strong>수정자 ID</strong>
                  <div style={{ marginTop: '4px', wordBreak: 'break-all' }}>
                    {item.changed_by || '-'}
                  </div>
                </div>

                <div>
                  <strong>행사 ID</strong>
                  <div style={{ marginTop: '4px', wordBreak: 'break-all' }}>
                    {item.event_id}
                  </div>
                </div>

                <div>
                  <strong>출석 ID</strong>
                  <div style={{ marginTop: '4px', wordBreak: 'break-all' }}>
                    {item.attendance_id || '-'}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <strong>사유</strong>
                <div style={{ marginTop: '4px' }}>{item.reason || '-'}</div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    border: '1px solid #eee',
                    borderRadius: '10px',
                    background: '#fafafa',
                    padding: '12px',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '8px' }}>변경 전</div>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: '13px',
                    }}
                  >
                    {prettyJson(item.before_value)}
                  </pre>
                </div>

                <div
                  style={{
                    border: '1px solid #eee',
                    borderRadius: '10px',
                    background: '#fafafa',
                    padding: '12px',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '8px' }}>변경 후</div>
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: '13px',
                    }}
                  >
                    {prettyJson(item.after_value)}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
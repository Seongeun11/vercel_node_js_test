// app/admin/admin-only/logs/page.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type LogAction = 'create' | 'update' | 'correct' | 'mark_absent' | 'delete'

type ProfileMeta = {
  id: string
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
}

type EventMeta = {
  id: string
  name: string
  start_time: string | null
}

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
  changed_by_profile: ProfileMeta | null
  target_user_profile: ProfileMeta | null
  event_meta: EventMeta | null
}

type LogsResponse = {
  items?: AttendanceLogItem[]
  error?: string
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatAction(action: LogAction) {
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

function stringifySafe(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return '{}'
  }
}

function getStatusLabel(value: unknown) {
  if (value === 'present') return '출석'
  if (value === 'late') return '지각'
  if (value === 'absent') return '결석'
  return String(value ?? '-')
}

function extractChangedFields(
  beforeValue: Record<string, unknown>,
  afterValue: Record<string, unknown>
) {
  const keys = new Set([
    ...Object.keys(beforeValue ?? {}),
    ...Object.keys(afterValue ?? {}),
  ])

  return [...keys]
    .map((key) => {
      const before = beforeValue?.[key]
      const after = afterValue?.[key]

      // 값 변화가 없는 필드는 제외
      if (JSON.stringify(before) === JSON.stringify(after)) {
        return null
      }

      return {
        key,
        before,
        after,
      }
    })
    .filter(Boolean) as Array<{
    key: string
    before: unknown
    after: unknown
  }>
}

export default function AdminAttendanceLogsPage() {
  const [items, setItems] = useState<AttendanceLogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // 필터 상태
  const [eventId, setEventId] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [changedBy, setChangedBy] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()

      if (eventId.trim()) params.set('event_id', eventId.trim())
      if (targetUserId.trim()) params.set('target_user_id', targetUserId.trim())
      if (changedBy.trim()) params.set('changed_by', changedBy.trim())
      if (dateFrom.trim()) params.set('date_from', dateFrom.trim())
      if (dateTo.trim()) params.set('date_to', dateTo.trim())
      params.set('limit', '100')

      const response = await fetch(`/api/logs?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      })

      const data = (await response.json()) as LogsResponse

      if (!response.ok) {
        throw new Error(data.error || '로그를 불러오지 못했습니다.')
      }

      setItems(Array.isArray(data.items) ? data.items : [])
    } catch (err) {
      setItems([])
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [eventId, targetUserId, changedBy, dateFrom, dateTo])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const hasActiveFilter = useMemo(() => {
    return Boolean(
      eventId.trim() ||
        targetUserId.trim() ||
        changedBy.trim() ||
        dateFrom.trim() ||
        dateTo.trim()
    )
  }, [eventId, targetUserId, changedBy, dateFrom, dateTo])

  const resetFilters = () => {
    setEventId('')
    setTargetUserId('')
    setChangedBy('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <main style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
          출석 로그
        </h1>
        <p style={{ color: '#666', margin: 0 }}>
          관리자 전용 감사 로그 조회 페이지입니다.
        </p>
      </div>

      {/* 필터 영역 */}
      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          background: '#fff',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
              이벤트 ID
            </label>
            <input
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder="event_id"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
              대상 사용자 ID
            </label>
            <input
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="target_user_id"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
              변경자 ID
            </label>
            <input
              value={changedBy}
              onChange={(e) => setChangedBy(e.target.value)}
              placeholder="changed_by"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
              시작일
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
              종료일
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => void fetchLogs()} style={primaryButtonStyle}>
            조회
          </button>

          <button
            onClick={() => {
              resetFilters()
            }}
            style={secondaryButtonStyle}
            disabled={!hasActiveFilter}
          >
            필터 초기화
          </button>
        </div>
      </section>

      {/* 상태 표시 */}
      {loading && (
        <div style={infoBoxStyle}>
          로그를 불러오는 중입니다...
        </div>
      )}

      {!loading && error && (
        <div style={errorBoxStyle}>
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div style={infoBoxStyle}>
          조회된 로그가 없습니다.
        </div>
      )}

      {/* 로그 목록 */}
      {!loading && !error && items.length > 0 && (
        <section style={{ display: 'grid', gap: '16px' }}>
          {items.map((item) => {
            const changedFields = extractChangedFields(
              item.before_value ?? {},
              item.after_value ?? {}
            )

            return (
              <article
                key={item.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '14px',
                  padding: '18px',
                  background: '#fff',
                }}
              >
                {/* 헤더 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
                    flexWrap: 'wrap',
                    marginBottom: '14px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 800 }}>
                      {formatAction(item.action)}
                    </div>
                    <div style={{ color: '#666', marginTop: '4px', fontSize: '14px' }}>
                      로그 ID: {item.id}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', color: '#666', fontSize: '14px' }}>
                    <div>변경 시각</div>
                    <div style={{ fontWeight: 600, color: '#111' }}>
                      {formatDateTime(item.changed_at)}
                    </div>
                  </div>
                </div>

                {/* 기본 정보 */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={metaCardStyle}>
                    <div style={metaTitleStyle}>이벤트</div>
                    <div style={metaValueStyle}>
                      {item.event_meta?.name ?? '알 수 없음'}
                    </div>
                    <div style={metaSubStyle}>ID: {item.event_id || '-'}</div>
                  </div>

                  <div style={metaCardStyle}>
                    <div style={metaTitleStyle}>대상 사용자</div>
                    <div style={metaValueStyle}>
                      {item.target_user_profile?.full_name ?? '알 수 없음'}
                    </div>
                    <div style={metaSubStyle}>
                      학번: {item.target_user_profile?.student_id ?? '-'}
                    </div>
                    <div style={metaSubStyle}>
                      역할: {item.target_user_profile?.role ?? '-'}
                    </div>
                  </div>

                  <div style={metaCardStyle}>
                    <div style={metaTitleStyle}>변경자</div>
                    <div style={metaValueStyle}>
                      {item.changed_by_profile?.full_name ?? '시스템/알 수 없음'}
                    </div>
                    <div style={metaSubStyle}>
                      학번: {item.changed_by_profile?.student_id ?? '-'}
                    </div>
                    <div style={metaSubStyle}>
                      역할: {item.changed_by_profile?.role ?? '-'}
                    </div>
                  </div>

                  <div style={metaCardStyle}>
                    <div style={metaTitleStyle}>출석 날짜</div>
                    <div style={metaValueStyle}>{item.date || '-'}</div>
                    <div style={metaSubStyle}>
                      attendance_id: {item.attendance_id ?? '-'}
                    </div>
                  </div>
                </div>

                {/* 변경 사유 */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>사유</div>
                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '10px',
                      padding: '12px',
                      background: '#fafafa',
                      color: '#333',
                    }}
                  >
                    {item.reason || '-'}
                  </div>
                </div>

                {/* 변경 필드 */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontWeight: 700, marginBottom: '8px' }}>변경 내용</div>

                  {changedFields.length === 0 ? (
                    <div style={infoInlineStyle}>비교 가능한 변경 필드가 없습니다.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {changedFields.map((field) => (
                        <div
                          key={field.key}
                          style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '10px',
                            padding: '12px',
                            background: '#fff',
                          }}
                        >
                          <div style={{ fontWeight: 700, marginBottom: '8px' }}>
                            {field.key}
                          </div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: '12px',
                            }}
                          >
                            <div>
                              <div style={{ color: '#666', marginBottom: '4px' }}>이전</div>
                              <div style={compareValueStyle}>
                                {field.key === 'status'
                                  ? getStatusLabel(field.before)
                                  : String(field.before ?? '-')}
                              </div>
                            </div>

                            <div>
                              <div style={{ color: '#666', marginBottom: '4px' }}>이후</div>
                              <div style={compareValueStyle}>
                                {field.key === 'status'
                                  ? getStatusLabel(field.after)
                                  : String(field.after ?? '-')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 원본 JSON */}
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                    원본 데이터 보기
                  </summary>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      marginTop: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: '6px' }}>before_value</div>
                      <pre style={preStyle}>{stringifySafe(item.before_value)}</pre>
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, marginBottom: '6px' }}>after_value</div>
                      <pre style={preStyle}>{stringifySafe(item.after_value)}</pre>
                    </div>
                  </div>
                </details>
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '40px',
  padding: '0 12px',
  borderRadius: '10px',
  border: '1px solid #d1d5db',
  outline: 'none',
  background: '#fff',
}

const primaryButtonStyle: React.CSSProperties = {
  height: '40px',
  padding: '0 16px',
  borderRadius: '10px',
  border: 'none',
  background: '#111827',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  height: '40px',
  padding: '0 16px',
  borderRadius: '10px',
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#111827',
  fontWeight: 700,
  cursor: 'pointer',
}

const infoBoxStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: '12px',
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  color: '#374151',
}

const errorBoxStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: '12px',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#b91c1c',
}

const infoInlineStyle: React.CSSProperties = {
  padding: '12px',
  borderRadius: '10px',
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  color: '#4b5563',
}

const metaCardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '12px',
  background: '#fafafa',
}

const metaTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  color: '#6b7280',
  marginBottom: '6px',
}

const metaValueStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#111827',
}

const metaSubStyle: React.CSSProperties = {
  marginTop: '4px',
  fontSize: '13px',
  color: '#6b7280',
}

const compareValueStyle: React.CSSProperties = {
  minHeight: '40px',
  padding: '10px 12px',
  borderRadius: '8px',
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  color: '#111827',
  wordBreak: 'break-word',
}

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: '12px',
  borderRadius: '10px',
  background: '#111827',
  color: '#f9fafb',
  overflowX: 'auto',
  fontSize: '12px',
  lineHeight: 1.5,
}
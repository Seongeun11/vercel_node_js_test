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

function formatRole(role: ProfileMeta['role'] | null | undefined) {
  switch (role) {
    case 'admin':
      return '관리자'
    case 'captain':
      return '캡틴'
    case 'trainee':
      return '수련생'
    default:
      return '-'
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

function formatFieldName(key: string): string {
  const labelMap: Record<string, string> = {
    status: '출석 상태',
    check_time: '체크 시각',
    attendance_date: '출석 날짜',
    date: '날짜',
    method: '출석 방식',
    reason: '사유',
    event_id: '이벤트',
    user_id: '사용자',
    target_user_id: '대상 사용자',
    changed_by: '변경자',
    occurrence_id: '회차',
    attendance_id: '출석 기록',
  }

  return labelMap[key] ?? key
}

function formatFieldValue(key: string, value: unknown): string {
  if (key === 'status') return getStatusLabel(value)

  if (key.includes('time') && typeof value === 'string') {
    return formatDateTime(value)
  }

  if (value === null || value === undefined || value === '') return '-'

  if (typeof value === 'object') {
    return stringifySafe(value)
  }

  return String(value)
}

function buildLogTitle(item: AttendanceLogItem): string {
  const targetName = item.target_user_profile?.full_name ?? '알 수 없는 사용자'
  const eventName = item.event_meta?.name ?? '알 수 없는 이벤트'

  switch (item.action) {
    case 'create':
      return `${targetName}님의 ${eventName} 출석 기록이 생성되었습니다.`
    case 'update':
      return `${targetName}님의 ${eventName} 출석 기록이 수정되었습니다.`
    case 'correct':
      return `${targetName}님의 ${eventName} 출석 기록이 정정되었습니다.`
    case 'mark_absent':
      return `${targetName}님이 ${eventName}에서 결석 처리되었습니다.`
    case 'delete':
      return `${targetName}님의 ${eventName} 출석 기록이 삭제되었습니다.`
    default:
      return `${targetName}님의 출석 로그가 기록되었습니다.`
  }
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
          출석 감사 로그
        </h1>
        <p style={{ color: '#666', margin: 0 }}>
          출석 생성, 수정, 정정, 결석 처리, 삭제 이력을 확인합니다.
        </p>
      </div>

      <section style={filterPanelStyle}>
        <div style={filterGridStyle}>
          <FilterInput
            label="이벤트 ID"
            value={eventId}
            onChange={setEventId}
            placeholder="event_id"
          />

          <FilterInput
            label="대상 사용자 ID"
            value={targetUserId}
            onChange={setTargetUserId}
            placeholder="target_user_id"
          />

          <FilterInput
            label="변경자 ID"
            value={changedBy}
            onChange={setChangedBy}
            placeholder="changed_by"
          />

          <FilterInput
            label="시작일"
            type="date"
            value={dateFrom}
            onChange={setDateFrom}
          />

          <FilterInput
            label="종료일"
            type="date"
            value={dateTo}
            onChange={setDateTo}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => void fetchLogs()} style={primaryButtonStyle}>
            조회
          </button>

          <button
  type="button"
  onClick={() => {
    if (!hasActiveFilter) return
    resetFilters()
  }}
  style={{
    ...secondaryButtonStyle,
    opacity: hasActiveFilter ? 1 : 0.5,
    cursor: hasActiveFilter ? 'pointer' : 'not-allowed',
  }}
>
  필터 초기화
</button>
        </div>
      </section>

      {loading && <div style={infoBoxStyle}>로그를 불러오는 중입니다...</div>}

      {!loading && error && <div style={errorBoxStyle}>{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div style={infoBoxStyle}>조회된 로그가 없습니다.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <section style={{ display: 'grid', gap: '16px' }}>
          {items.map((item) => {
            const changedFields = extractChangedFields(
              item.before_value ?? {},
              item.after_value ?? {}
            )

            return (
              <article key={item.id} style={logCardStyle}>
                <div style={cardHeaderStyle}>
                  <div>
                    <div style={logTitleStyle}>{buildLogTitle(item)}</div>

                    <div style={logSubTextStyle}>
                      작업 유형: {formatAction(item.action)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', color: '#666', fontSize: '14px' }}>
                    <div>변경 시각</div>
                    <div style={{ fontWeight: 700, color: '#111' }}>
                      {formatDateTime(item.changed_at)}
                    </div>
                  </div>
                </div>

                <div style={metaGridStyle}>
                  <MetaCard
                    title="이벤트"
                    value={item.event_meta?.name ?? '알 수 없음'}
                    subTexts={[
                      `날짜: ${item.date || '-'}`,
                      `시작: ${formatDateTime(item.event_meta?.start_time)}`,
                    ]}
                  />

                  <MetaCard
                    title="대상 사용자"
                    value={item.target_user_profile?.full_name ?? '알 수 없음'}
                    subTexts={[
                      `학번: ${item.target_user_profile?.student_id ?? '-'}`,
                      `역할: ${formatRole(item.target_user_profile?.role)}`,
                    ]}
                  />

                  <MetaCard
                    title="변경자"
                    value={item.changed_by_profile?.full_name ?? '시스템/알 수 없음'}
                    subTexts={[
                      `학번: ${item.changed_by_profile?.student_id ?? '-'}`,
                      `역할: ${formatRole(item.changed_by_profile?.role)}`,
                    ]}
                  />

                  <MetaCard
                    title="출석 기록"
                    value={item.attendance_id ? '기록 있음' : '기록 없음'}
                    subTexts={[
                      `로그 ID: ${item.id}`,
                      `출석 ID: ${item.attendance_id ?? '-'}`,
                    ]}
                  />
                </div>

                <section style={{ marginBottom: '16px' }}>
                  <div style={sectionTitleStyle}>사유</div>
                  <div style={reasonBoxStyle}>{item.reason || '-'}</div>
                </section>

                <section style={{ marginBottom: '16px' }}>
                  <div style={sectionTitleStyle}>변경 내용</div>

                  {changedFields.length === 0 ? (
                    <div style={infoInlineStyle}>비교 가능한 변경 필드가 없습니다.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {changedFields.map((field) => (
                        <div key={field.key} style={changeCardStyle}>
                          <div style={{ fontWeight: 800, marginBottom: '8px' }}>
                            {formatFieldName(field.key)}
                          </div>

                          <div style={compareGridStyle}>
                            <div>
                              <div style={compareLabelStyle}>이전</div>
                              <div style={compareValueStyle}>
                                {formatFieldValue(field.key, field.before)}
                              </div>
                            </div>

                            <div>
                              <div style={compareLabelStyle}>이후</div>
                              <div style={compareValueStyle}>
                                {formatFieldValue(field.key, field.after)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                    원본 데이터 보기
                  </summary>

                  <div style={rawJsonGridStyle}>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                        before_value
                      </div>
                      <pre style={preStyle}>{stringifySafe(item.before_value)}</pre>
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                        after_value
                      </div>
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

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label style={{ display: 'block', fontWeight: 700, marginBottom: '6px' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  )
}

function MetaCard({
  title,
  value,
  subTexts,
}: {
  title: string
  value: string
  subTexts: string[]
}) {
  return (
    <div style={metaCardStyle}>
      <div style={metaTitleStyle}>{title}</div>
      <div style={metaValueStyle}>{value}</div>
      {subTexts.map((text) => (
        <div key={text} style={metaSubStyle}>
          {text}
        </div>
      ))}
    </div>
  )
}

const filterPanelStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '20px',
  background: '#fff',
}

const filterGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
  marginBottom: '12px',
}

const logCardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '14px',
  padding: '18px',
  background: '#fff',
}

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  flexWrap: 'wrap',
  marginBottom: '14px',
}

const logTitleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 800,
  lineHeight: 1.4,
}

const logSubTextStyle: React.CSSProperties = {
  marginTop: '6px',
  color: '#6b7280',
  fontSize: '14px',
}

const metaGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
  marginBottom: '16px',
}

const sectionTitleStyle: React.CSSProperties = {
  fontWeight: 800,
  marginBottom: '8px',
}

const reasonBoxStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '12px',
  background: '#fafafa',
  color: '#333',
}

const changeCardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '12px',
  background: '#fff',
}

const compareGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
}

const compareLabelStyle: React.CSSProperties = {
  color: '#666',
  marginBottom: '4px',
}

const rawJsonGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
  marginTop: '12px',
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
  whiteSpace: 'pre-wrap',
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
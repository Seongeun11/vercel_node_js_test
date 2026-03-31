'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredUser, hasRole } from '@/lib/auth'

type StoredUser = {
  id: string
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
}

type AttendanceSnapshot = {
  id?: string
  user_id?: string
  event_id?: string
  date?: string
  status?: string
  check_time?: string | null
  method?: string | null
}

type ProfileInfo = {
  full_name: string
  student_id: string
  role: string
}

type EventInfo = {
  name: string
  start_time: string
}

type AttendanceLog = {
  id: string
  attendance_id: string | null
  changed_by: string | null
  before_value: AttendanceSnapshot | null
  after_value: AttendanceSnapshot | null
  changed_at: string | null
  changed_by_profile: ProfileInfo | null
  before_user_profile: ProfileInfo | null
  after_user_profile: ProfileInfo | null
  before_event_info: EventInfo | null
  after_event_info: EventInfo | null
}

type LogsResponse = {
  logs?: AttendanceLog[]
  error?: string
}

export default function LogsPage() {
  const router = useRouter()

  const [actor, setActor] = useState<StoredUser | null>(null)
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    const savedUser = getStoredUser() as StoredUser | null

    if (!savedUser) {
      router.replace('/login')
      return
    }

    if (!hasRole(savedUser, ['admin', 'captain'])) {
      alert('캡틴 이상만 접근할 수 있습니다.')
      router.replace('/')
      return
    }

    setActor(savedUser)
  }, [router])

  useEffect(() => {
    if (!actor?.id) return

    const fetchLogs = async () => {
      try {
        setLoading(true)
        setErrorMessage('')

        const response = await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actor_user_id: actor.id }),
        })

        const result: LogsResponse =
          response.headers.get('content-type')?.includes('application/json')
            ? await response.json()
            : { error: '로그 응답 형식이 올바르지 않습니다.' }

        if (!response.ok) {
          setErrorMessage(result.error || '로그를 불러오지 못했습니다.')
          return
        }

        setLogs(result.logs ?? [])
      } catch (error) {
        console.error('로그 조회 실패:', error)
        setErrorMessage('로그 조회 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [actor])

  const formatDateTime = (value: string | null | undefined) => {
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

  const getStatusText = (value?: string) => {
    if (!value) return '-'
    if (value === 'present') return '출석'
    if (value === 'late') return '지각'
    if (value === 'absent') return '결석'
    return value
  }

  const getActionLabel = (log: AttendanceLog) => {
    if (!log.before_value && log.after_value) return '신규 등록'
    if (log.before_value && log.after_value) return '수정'
    return '기타'
  }

  const getProfileText = (profile: ProfileInfo | null | undefined, fallbackId?: string | null) => {
    if (!profile) return fallbackId || '-'
    return `${profile.full_name} (${profile.student_id})`
  }

  const getEventText = (event: EventInfo | null | undefined, fallbackId?: string | null) => {
    if (!event) return fallbackId || '-'
    return event.name
  }

  const filteredLogs = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return logs

    return logs.filter((log) => {
      const values = [
        log.changed_by_profile?.full_name,
        log.changed_by_profile?.student_id,
        log.before_user_profile?.full_name,
        log.before_user_profile?.student_id,
        log.after_user_profile?.full_name,
        log.after_user_profile?.student_id,
        log.before_event_info?.name,
        log.after_event_info?.name,
        log.before_value?.status,
        log.after_value?.status,
        log.before_value?.date,
        log.after_value?.date,
        log.changed_at,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return values.includes(keyword)
    })
  }, [logs, searchText])

  if (!actor || loading) {
    return <div style={{ padding: '20px' }}>로딩중...</div>
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2>출석 수정 이력</h2>

      <p style={{ marginBottom: '16px' }}>
        조회자: {actor.full_name} ({actor.student_id}) / 권한: {actor.role}
      </p>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="이름, 학번, 이벤트명, 상태 검색"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{
            flex: 1,
            minWidth: '260px',
            padding: '10px',
            boxSizing: 'border-box',
          }}
        />

        <button onClick={() => router.push('/')}>메인으로</button>
      </div>

      {errorMessage && (
        <p style={{ color: 'crimson', marginBottom: '16px' }}>
          ⚠️ {errorMessage}
        </p>
      )}

      {filteredLogs.length === 0 ? (
        <p>표시할 로그가 없습니다.</p>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '10px',
                padding: '16px',
                backgroundColor: '#fff',
              }}
            >
              <div style={{ marginBottom: '10px', fontWeight: 700 }}>
                {getActionLabel(log)}
              </div>

              <div style={{ marginBottom: '6px' }}>
                <strong>변경 시각:</strong> {formatDateTime(log.changed_at)}
              </div>

              <div style={{ marginBottom: '6px' }}>
                <strong>수정자:</strong> {getProfileText(log.changed_by_profile, log.changed_by)}
              </div>

              <div style={{ marginBottom: '12px' }}>
                <strong>attendance_id:</strong> {log.attendance_id ?? '-'}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    border: '1px solid #eee',
                    borderRadius: '8px',
                    padding: '12px',
                    backgroundColor: '#fafafa',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '8px' }}>변경 전</div>
                  <div>
                    <strong>사용자:</strong>{' '}
                    {getProfileText(log.before_user_profile, log.before_value?.user_id)}
                  </div>
                  <div>
                    <strong>이벤트:</strong>{' '}
                    {getEventText(log.before_event_info, log.before_value?.event_id)}
                  </div>
                  <div><strong>date:</strong> {log.before_value?.date ?? '-'}</div>
                  <div><strong>status:</strong> {getStatusText(log.before_value?.status)}</div>
                  <div><strong>method:</strong> {log.before_value?.method ?? '-'}</div>
                  <div>
                    <strong>check_time:</strong> {formatDateTime(log.before_value?.check_time)}
                  </div>
                </div>

                <div
                  style={{
                    border: '1px solid #eee',
                    borderRadius: '8px',
                    padding: '12px',
                    backgroundColor: '#fafafa',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: '8px' }}>변경 후</div>
                  <div>
                    <strong>사용자:</strong>{' '}
                    {getProfileText(log.after_user_profile, log.after_value?.user_id)}
                  </div>
                  <div>
                    <strong>이벤트:</strong>{' '}
                    {getEventText(log.after_event_info, log.after_value?.event_id)}
                  </div>
                  <div><strong>date:</strong> {log.after_value?.date ?? '-'}</div>
                  <div><strong>status:</strong> {getStatusText(log.after_value?.status)}</div>
                  <div><strong>method:</strong> {log.after_value?.method ?? '-'}</div>
                  <div>
                    <strong>check_time:</strong> {formatDateTime(log.after_value?.check_time)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
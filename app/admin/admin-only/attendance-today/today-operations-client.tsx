'use client'

import { useEffect, useMemo, useState } from 'react'

type ExpireUnit = 'minutes' | 'days'
type AttendanceStatus = 'present' | 'late' | 'absent'

type TodayOccurrenceItem = {
  id: string
  event_id: string
  occurrence_date: string
  start_time: string
  end_time: string | null
  status: 'scheduled' | 'open' | 'closed' | 'archived'
  created_at: string
  updated_at: string
  events: {
    id: string
    name: string
    start_time: string
    late_threshold_min: number
    allow_duplicate_check: boolean
    is_special_event: boolean
    recurrence_type: 'none' | 'daily'
    is_active: boolean
  } | null
}

type QrItem = {
  id: string
  event_id: string
  occurrence_id: string
  token: string
  expires_at: string
  used_count: number
  created_at: string
  is_expired: boolean
  occurrence_date?: string | null
  occurrence_status?: string | null
}

type AttendanceSummary = {
  total_checked_count: number
  present_count: number
  late_count: number
  absent_count: number
}

type AttendanceItem = {
  id: string
  user_id: string
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
  status: AttendanceStatus
  method: string | null
  check_time: string | null
  attendance_date: string | null
}

type AttendanceByOccurrenceResponse = {
  occurrence?: {
    id: string
    event_id: string
    occurrence_date: string
    start_time: string
    end_time: string | null
    status: string
    event: {
      id: string
      name: string
      late_threshold_min: number
      is_special_event: boolean
      recurrence_type: 'none' | 'daily'
    } | null
  }
  summary?: AttendanceSummary
  items?: AttendanceItem[]
  error?: string
}

type MissingItem = {
  id: string
  full_name: string
  student_id: string
  role: 'trainee'
}

type MissingByOccurrenceResponse = {
  occurrence?: {
    id: string
    event_id: string
    occurrence_date: string
    start_time: string
    end_time: string | null
    status: 'scheduled' | 'open' | 'closed' | 'archived'
    event: {
      id: string
      name: string
      late_threshold_min: number
      is_special_event: boolean
      recurrence_type: 'none' | 'daily'
      is_active: boolean
    } | null
  }
  count?: number
  items?: MissingItem[]
  error?: string
}

export default function TodayOperationsClient() {
  const [date, setDate] = useState('')
  const [items, setItems] = useState<TodayOccurrenceItem[]>([])
  const [qrMap, setQrMap] = useState<Record<string, QrItem[]>>({})
  const [attendanceMap, setAttendanceMap] = useState<
    Record<
      string,
      {
        summary: AttendanceSummary
        items: AttendanceItem[]
      }
    >
  >({})
  const [missingMap, setMissingMap] = useState<
    Record<
      string,
      {
        count: number
        items: MissingItem[]
      }
    >
  >({})
  const [expandedOccurrenceIds, setExpandedOccurrenceIds] = useState<Record<string, boolean>>({})
  const [expandedMissingIds, setExpandedMissingIds] = useState<Record<string, boolean>>({})
  const [qrExpireUnitMap, setQrExpireUnitMap] = useState<Record<string, ExpireUnit>>({})
  const [qrExpireValueMap, setQrExpireValueMap] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [attendanceLoadingMap, setAttendanceLoadingMap] = useState<Record<string, boolean>>({})
  const [missingLoadingMap, setMissingLoadingMap] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const totalCount = items.length
  const openCount = useMemo(
    () => items.filter((item) => item.status === 'open').length,
    [items]
  )
  const closedCount = useMemo(
    () => items.filter((item) => item.status === 'closed').length,
    [items]
  )
  const totalQrCount = useMemo(
    () => Object.values(qrMap).reduce((sum, list) => sum + list.length, 0),
    [qrMap]
  )
  const activeQrCount = useMemo(
    () =>
      Object.values(qrMap).reduce(
        (sum, list) => sum + list.filter((qr) => !qr.is_expired).length,
        0
      ),
    [qrMap]
  )

  async function ensureTodayOccurrences() {
    const res = await fetch('/api/event-occurrences/ensure-today', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || '오늘 회차 생성에 실패했습니다.')
    }

    return data
  }

  async function fetchTodayOccurrences() {
    const res = await fetch('/api/event-occurrences/ensure-today/today', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || '오늘 회차 조회에 실패했습니다.')
    }

    return {
      date: String(data.date ?? ''),
      items: Array.isArray(data.items) ? (data.items as TodayOccurrenceItem[]) : [],
    }
  }

  async function fetchQrByOccurrence(occurrenceId: string) {
    const res = await fetch('/api/qr/list', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ occurrence_id: occurrenceId }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'QR 조회에 실패했습니다.')
    }

    const qrTokens = Array.isArray(data.qr_tokens) ? (data.qr_tokens as QrItem[]) : []

    setQrMap((prev) => ({
      ...prev,
      [occurrenceId]: qrTokens,
    }))

    return qrTokens
  }

  async function fetchAttendanceByOccurrence(occurrenceId: string) {
    setAttendanceLoadingMap((prev) => ({ ...prev, [occurrenceId]: true }))

    try {
      const res = await fetch('/api/attendance/by-occurrence', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ occurrence_id: occurrenceId }),
      })

      const data = (await res.json()) as AttendanceByOccurrenceResponse

      if (!res.ok) {
        throw new Error(data.error || '출석 현황 조회에 실패했습니다.')
      }

      setAttendanceMap((prev) => ({
        ...prev,
        [occurrenceId]: {
          summary: data.summary ?? {
            total_checked_count: 0,
            present_count: 0,
            late_count: 0,
            absent_count: 0,
          },
          items: Array.isArray(data.items) ? data.items : [],
        },
      }))
    } finally {
      setAttendanceLoadingMap((prev) => ({ ...prev, [occurrenceId]: false }))
    }
  }

  async function fetchMissingByOccurrence(occurrenceId: string) {
    setMissingLoadingMap((prev) => ({ ...prev, [occurrenceId]: true }))

    try {
      const res = await fetch('/api/attendance/missing-by-occurrence', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ occurrence_id: occurrenceId }),
      })

      const data = (await res.json()) as MissingByOccurrenceResponse

      if (!res.ok) {
        throw new Error(data.error || '미출석 목록 조회에 실패했습니다.')
      }

      setMissingMap((prev) => ({
        ...prev,
        [occurrenceId]: {
          count: Number(data.count ?? 0),
          items: Array.isArray(data.items) ? data.items : [],
        },
      }))
    } finally {
      setMissingLoadingMap((prev) => ({ ...prev, [occurrenceId]: false }))
    }
  }

  async function refreshToday() {
    try {
      setLoading(true)
      setError('')
      setSuccess('')

      await ensureTodayOccurrences()

      const todayData = await fetchTodayOccurrences()
      setDate(todayData.date)
      setItems(todayData.items)

      await Promise.all([
        ...todayData.items.map((item) => fetchQrByOccurrence(item.id)),
        ...todayData.items.map((item) => fetchAttendanceByOccurrence(item.id)),
        ...todayData.items.map((item) => fetchMissingByOccurrence(item.id)),
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : '오늘 운영 화면을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshToday()
  }, [])

  function validateQrExpireSetting(expireUnit: ExpireUnit, expireValue: number) {
    if (expireUnit === 'minutes') {
      if (!Number.isInteger(expireValue) || expireValue < 10 || expireValue % 10 !== 0|| expireValue >1440) {
        return '분 단위 QR 유효시간은 10분 단위 최대 1440분 (24시간)입니다. (예: 10, 20, 30)'
      }
      return ''
    }

    if (!Number.isInteger(expireValue) || expireValue < 1 || expireValue > 365) {
      return '일 단위 QR 유효시간은 1~365일 사이 정수여야 합니다.'
    }

    return ''
  }

  async function handleSyncToday() {
    try {
      setSyncing(true)
      setError('')
      setSuccess('')

      const data = await ensureTodayOccurrences()
      await refreshToday()

      setSuccess(
        `오늘 회차 동기화가 완료되었습니다. 생성 ${Number(data.created_count ?? 0)}건, 실패 ${Number(data.failed_count ?? 0)}건`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '오늘 회차 동기화에 실패했습니다.')
    } finally {
      setSyncing(false)
    }
  }

  async function handleCreateQr(occurrenceId: string) {
    const expireUnit = qrExpireUnitMap[occurrenceId] ?? 'minutes'
    const expireValue = Number(
      qrExpireValueMap[occurrenceId] ?? (expireUnit === 'minutes' ? '10' : '1')
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
          occurrence_id: occurrenceId,
          expire_unit: expireUnit,
          expire_value: expireValue,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'QR 생성에 실패했습니다.')
      }

      await fetchQrByOccurrence(occurrenceId)
      setSuccess(data.message || 'QR이 생성되었습니다.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR 생성 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReissueQr(qrId: string, occurrenceId: string) {
    const expireUnit = qrExpireUnitMap[occurrenceId] ?? 'minutes'
    const expireValue = Number(
      qrExpireValueMap[occurrenceId] ?? (expireUnit === 'minutes' ? '10' : '1')
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
        throw new Error(data.error || 'QR 재발급에 실패했습니다.')
      }

      await fetchQrByOccurrence(occurrenceId)
      setSuccess(data.message || 'QR 유효 시간이 수정되었습니다.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR 재발급 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteQr(qrId: string, occurrenceId: string) {
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
        throw new Error(data.error || 'QR 삭제에 실패했습니다.')
      }

      await fetchQrByOccurrence(occurrenceId)
      setSuccess(data.message || 'QR이 삭제되었습니다.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR 삭제 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMarkAbsent(occurrenceId: string) {
    const confirmed = window.confirm(
      '아직 출석 기록이 없는 수련생들을 결석 처리하시겠습니까?'
    )
    if (!confirmed) return

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      const res = await fetch('/api/attendance/mark-absent-by-occurrence', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ occurrence_id: occurrenceId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '결석 처리에 실패했습니다.')
      }

      await Promise.all([
        fetchAttendanceByOccurrence(occurrenceId),
        fetchMissingByOccurrence(occurrenceId),
      ])

      setSuccess(
        data.message ||
          `결석 처리 완료: ${Number(data.marked_absent_count ?? 0)}명 처리`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '결석 처리 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCloseOccurrence(occurrenceId: string) {
    const missingState = missingMap[occurrenceId] ?? { count: 0, items: [] }
    const missingCount = Number(missingState.count ?? 0)

    const confirmMessage =
      missingCount > 0
        ? `아직 미출석 인원 ${missingCount}명이 있습니다.\n그래도 이 회차를 종료하시겠습니까?`
        : '이 회차를 종료하시겠습니까?'

    const confirmed = window.confirm(confirmMessage)
    if (!confirmed) return

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      const res = await fetch('/api/event-occurrences/close', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ occurrence_id: occurrenceId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '회차 종료에 실패했습니다.')
      }

      await refreshToday()
      setSuccess(data.message || '회차가 종료되었습니다.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '회차 종료 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleOccurrenceDetail(occurrenceId: string) {
    setExpandedOccurrenceIds((prev) => ({
      ...prev,
      [occurrenceId]: !prev[occurrenceId],
    }))
  }

  function toggleMissingDetail(occurrenceId: string) {
    setExpandedMissingIds((prev) => ({
      ...prev,
      [occurrenceId]: !prev[occurrenceId],
    }))
  }

  if (loading) {
    return <div style={{ padding: 20 }}>로딩중...</div>
  }

  return (
    <div style={{ padding: 20, display: 'grid', gap: 24 }}>
      <div>
        <h2 style={{ marginBottom: 8 }}>오늘 출석 운영</h2>
        <p style={{ color: '#666', margin: 0 }}>
          오늘 날짜 기준 회차 생성, QR 발급/재발급/삭제, 출석 현황을 관리하는 운영 화면입니다.
        </p>
      </div>

      <section style={summaryGridStyle}>
        <SummaryCard title="운영 날짜" value={date || '-'} />
        <SummaryCard title="오늘 회차 수" value={String(totalCount)} />
        <SummaryCard title="진행 중 회차" value={String(openCount)} />
        <SummaryCard title="종료 회차" value={String(closedCount)} />
        <SummaryCard title="전체 QR 수" value={String(totalQrCount)} />
        <SummaryCard title="활성 QR 수" value={String(activeQrCount)} />
      </section>

      <section style={panelStyle}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => void handleSyncToday()}
            disabled={syncing || submitting}
            style={primaryButtonStyle}
          >
            {syncing ? '동기화 중...' : '오늘 회차 동기화'}
          </button>

          <button
            onClick={() => void refreshToday()}
            disabled={loading || syncing || submitting}
            style={secondaryButtonStyle}
          >
            새로고침
          </button>
        </div>
      </section>

      {error && <div style={errorBoxStyle}>{error}</div>}
      {success && <div style={successBoxStyle}>{success}</div>}

      <section style={{ display: 'grid', gap: 16 }}>
        <h3 style={{ margin: 0 }}>오늘 회차 목록</h3>

        {items.length === 0 ? (
          <div style={emptyBoxStyle}>오늘 생성된 회차가 없습니다.</div>
        ) : (
          items.map((item) => {
            const qrs = qrMap[item.id] ?? []
            const attendanceState = attendanceMap[item.id] ?? {
              summary: {
                total_checked_count: 0,
                present_count: 0,
                late_count: 0,
                absent_count: 0,
              },
              items: [],
            }
            const missingState = missingMap[item.id] ?? {
              count: 0,
              items: [],
            }
            const attendanceLoading = attendanceLoadingMap[item.id] ?? false
            const missingLoading = missingLoadingMap[item.id] ?? false
            const expanded = expandedOccurrenceIds[item.id] ?? false
            const expandedMissing = expandedMissingIds[item.id] ?? false

            const expireUnit = qrExpireUnitMap[item.id] ?? 'minutes'
            const expireValue =
              qrExpireValueMap[item.id] ?? (expireUnit === 'minutes' ? '10' : '1')

            return (
              <article key={item.id} style={panelStyle}>
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
                      {item.events?.name ?? '알 수 없는 이벤트'}
                    </div>
                    <div style={{ color: '#666', marginTop: 6 }}>
                      회차 날짜: {item.occurrence_date}
                    </div>
                    <div style={{ color: '#666', marginTop: 4 }}>
                      시작 시간: {new Date(item.start_time).toLocaleString()}
                    </div>
                    <div style={{ color: '#666', marginTop: 4 }}>
                      상태: {formatOccurrenceStatus(item.status)} / 반복 규칙:{' '}
                      {item.events?.recurrence_type === 'daily' ? '매일' : '반복 없음'}
                    </div>
                    <div style={{ color: '#666', marginTop: 4 }}>
                      특별 행사: {item.events?.is_special_event ? '예' : '아니오'} / 지각 기준:{' '}
                      {item.events?.late_threshold_min ?? 5}분
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gap: 6 }}>
                    {Number((missingMap[item.id]?.count ?? 0)) > 0 && (
                      <div style={{ color: '#b91c1c', fontSize: 13 }}>
                        미출석 인원 {missingMap[item.id]?.count ?? 0}명이 남아 있습니다.
                      </div>
                    )}
                      <button
                        onClick={() => void handleMarkAbsent(item.id)}
                        disabled={submitting || item.status === 'archived'}
                        style={secondaryButtonStyle}
                      >
                        결석 처리
                      </button>

                      <button
                        onClick={() => void handleCloseOccurrence(item.id)}
                        disabled={submitting || item.status === 'closed' || item.status === 'archived'}
                        style={dangerButtonStyle}
                      >
                        회차 종료
                      </button>
                  </div>
                </div>

                <section style={attendanceSummarySectionStyle}>
                  <div style={attendanceSummaryGridStyle}>
                    <MiniSummaryCard
                      title="출석 인원"
                      value={String(attendanceState.summary.present_count)}
                    />
                    <MiniSummaryCard
                      title="지각 인원"
                      value={String(attendanceState.summary.late_count)}
                    />
                    <MiniSummaryCard
                      title="결석 인원"
                      value={String(attendanceState.summary.absent_count)}
                    />
                    <MiniSummaryCard
                      title="미출석 인원"
                      value={String(missingState.count)}
                    />
                    <MiniSummaryCard
                      title="전체 체크 인원"
                      value={String(attendanceState.summary.total_checked_count)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <button
                      onClick={() => void fetchAttendanceByOccurrence(item.id)}
                      disabled={attendanceLoading || submitting}
                      style={secondaryButtonStyle}
                    >
                      {attendanceLoading ? '조회 중...' : '출석 현황 새로고침'}
                    </button>

                    <button
                      onClick={() => toggleOccurrenceDetail(item.id)}
                      disabled={attendanceLoading}
                      style={secondaryButtonStyle}
                    >
                      {expanded ? '출석 상세 닫기' : '출석 상세 보기'}
                    </button>

                    <button
                      onClick={() => void fetchMissingByOccurrence(item.id)}
                      disabled={missingLoading || submitting}
                      style={secondaryButtonStyle}
                    >
                      {missingLoading ? '조회 중...' : '미출석 목록 새로고침'}
                    </button>

                    <button
                      onClick={() => toggleMissingDetail(item.id)}
                      disabled={missingLoading}
                      style={secondaryButtonStyle}
                    >
                      {expandedMissing ? '미출석 목록 닫기' : '미출석 목록 보기'}
                    </button>
                  </div>

                  {expanded && (
                    <div style={{ marginTop: 14 }}>
                      {attendanceState.items.length === 0 ? (
                        <div style={emptyBoxStyle}>출석 상세 데이터가 없습니다.</div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={tableStyle}>
                            <thead>
                              <tr style={{ background: '#f8fafc' }}>
                                <th style={thStyle}>이름</th>
                                <th style={thStyle}>학번</th>
                                <th style={thStyle}>역할</th>
                                <th style={thStyle}>상태</th>
                                <th style={thStyle}>방식</th>
                                <th style={thStyle}>체크 시각</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attendanceState.items.map((attendance) => (
                                <tr key={attendance.id}>
                                  <td style={tdStyle}>{attendance.full_name}</td>
                                  <td style={tdStyle}>{attendance.student_id}</td>
                                  <td style={tdStyle}>{formatRole(attendance.role)}</td>
                                  <td style={tdStyle}>{formatAttendanceStatus(attendance.status)}</td>
                                  <td style={tdStyle}>{attendance.method ?? '-'}</td>
                                  <td style={tdStyle}>
                                    {attendance.check_time
                                      ? new Date(attendance.check_time).toLocaleString()
                                      : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {expandedMissing && (
                    <div style={{ marginTop: 14 }}>
                      {missingState.items.length === 0 ? (
                        <div style={emptyBoxStyle}>미출석 인원이 없습니다.</div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={tableStyle}>
                            <thead>
                              <tr style={{ background: '#f8fafc' }}>
                                <th style={thStyle}>이름</th>
                                <th style={thStyle}>학번</th>
                                <th style={thStyle}>역할</th>
                              </tr>
                            </thead>
                            <tbody>
                              {missingState.items.map((missing) => (
                                <tr key={missing.id}>
                                  <td style={tdStyle}>{missing.full_name}</td>
                                  <td style={tdStyle}>{missing.student_id}</td>
                                  <td style={tdStyle}>{formatRole(missing.role)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </section>

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
                    <h4 style={{ margin: 0 }}>오늘 회차 QR 관리</h4>

                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      {(item.status === 'closed' || item.status === 'archived') && (
                        <div style={{ color: '#b91c1c', marginTop: 6, fontSize: 13 }}>
                          종료된 회차는 QR 발급/재발급이 제한됩니다.
                        </div>
                      )}

                      <select
                        value={expireUnit}
                        onChange={(e) => {
                          const nextUnit = e.target.value as ExpireUnit
                          setQrExpireUnitMap((prev) => ({
                            ...prev,
                            [item.id]: nextUnit,
                          }))
                          setQrExpireValueMap((prev) => ({
                            ...prev,
                            [item.id]: nextUnit === 'minutes' ? '10' : '1',
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
                        min={expireUnit === 'minutes' ? 10 : 1}
                        step={expireUnit === 'minutes' ? 10 : 1}
                        value={expireValue}
                        onChange={(e) =>
                          setQrExpireValueMap((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        style={{ ...inputStyle, width: 120 }}
                        disabled={submitting}
                      />

                      <span style={{ color: '#666' }}>
                        {expireUnit === 'minutes' ? '분' : '일'}
                      </span>

                      <button
                        onClick={() => void handleCreateQr(item.id)}
                        disabled={submitting || item.status === 'closed' || item.status === 'archived'}
                        style={primaryButtonStyle}
                      >
                        QR 발급
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
                              <td style={tdStyle}>{qr.is_expired ? '만료됨' : '유효'}</td>
                              <td style={tdStyle}>{qr.used_count}</td>
                              <td style={tdStyle}>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  <button
                                    onClick={() => void handleReissueQr(qr.id, item.id)}
                                    disabled={submitting || item.status === 'closed' || item.status === 'archived'}
                                    style={secondaryButtonStyle}
                                  >
                                    QR 재발급
                                  </button>
                                  <button
                                    onClick={() => void handleDeleteQr(qr.id, item.id)}
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

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={summaryCardStyle}>
      <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
    </div>
  )
}

function MiniSummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={miniSummaryCardStyle}>
      <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
    </div>
  )
}

function formatOccurrenceStatus(status: string) {
  switch (status) {
    case 'scheduled':
      return '예정'
    case 'open':
      return '진행 중'
    case 'closed':
      return '종료'
    case 'archived':
      return '보관'
    default:
      return status
  }
}

function formatAttendanceStatus(status: AttendanceStatus) {
  switch (status) {
    case 'present':
      return '출석'
    case 'late':
      return '지각'
    case 'absent':
      return '결석'
    default:
      return status
  }
}

function formatRole(role: 'admin' | 'captain' | 'trainee') {
  switch (role) {
    case 'admin':
      return '관리자'
    case 'captain':
      return '캡틴'
    case 'trainee':
      return '수련생'
    default:
      return role
  }
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

const attendanceSummarySectionStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 14,
  borderRadius: 10,
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
}

const summaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 12,
}

const summaryCardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
}

const attendanceSummaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 10,
}

const miniSummaryCardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 12,
  background: '#fff',
}

const inputStyle: React.CSSProperties = {
  height: 40,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid #ccc',
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
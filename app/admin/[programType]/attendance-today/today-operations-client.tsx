'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import QRCode from 'qrcode'

// ==========================================
// 1. 타입 정의 (기존 데이터 구조 완벽 유지)
// ==========================================
type ExpireUnit = 'hours' | 'days' | 'unlimited'
type WeekdayCode = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
type AttendanceStatus = 'present' | 'late' | 'absent'

type UserRole = {
  id: number
  name: 'admin' | 'captain' | 'trainee'
}

type TodayOccurrenceItem = {
  id: string
  event_id: string
  occurrence_date: string
  start_time: string
  end_time: string | null
  status: 'scheduled' | 'open' | 'closed' | 'archived'
  created_at: string
  updated_at: string
  event: {
    id: string
    name: string
    start_time: string
    late_threshold_min: number
    allow_duplicate_check: boolean
    is_special_event: boolean
    recurrence_type: 'none' | 'daily'
    recurrence_days: WeekdayCode[]
    is_active: boolean
  } | null
}

type QrItem = {
  id: string
  event_id: string
  occurrence_id: string | null
  token_preview?: string | null
  qr_url?: string | null
  expires_at: string | null
  used_count: number
  created_at: string
  is_expired: boolean
  occurrence_date?: string | null
  occurrence_status?: string | null
}

type QrCreateResponse = {
  message?: string
  qr_token?: {
    id: string
    event_id: string
    occurrence_id: string | null
    expires_at: string | null
    used_count: number
    created_at: string
    token_preview?: string | null
  }
  qr_url?: string
  error?: string
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
  profiles: {
    roles: UserRole
  }
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
  profiles: {
    roles: UserRole
  }
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

// ==========================================
// 2. 메인 최상위 컴포넌트
// ==========================================
export default function TodayOperationsClient() {
  const [date, setDate] = useState('')
  const [items, setItems] = useState<TodayOccurrenceItem[]>([])
  
  // 개별 회차 카드에서 발생하는 전역 알림 관리
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  // 상단 요약 통계용 상태 계산값 (기존 구조 유지)
  const [qrCounts, setQrCounts] = useState<{ total: number; active: number }>({ total: 0, active: 0 })
  const openCount = useMemo(() => items.filter((item) => item.status === 'open').length, [items])
  const closedCount = useMemo(() => items.filter((item) => item.status === 'closed').length, [items])

  // 공통 API 함수들
  async function ensureTodayOccurrences() {
    const res = await fetch('/api/event-occurrences/ensure-today', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '오늘 회차 생성에 실패했습니다.')
    return data
  }

  async function fetchTodayOccurrences() {
    const res = await fetch('/api/event-occurrences/ensure-today/today', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '오늘 회차 조회에 실패했습니다.')
    return {
      date: String(data.date ?? ''),
      items: Array.isArray(data.items) ? (data.items as TodayOccurrenceItem[]) : [],
    }
  }

  const refreshToday = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      setSuccess('')

      await ensureTodayOccurrences()
      const todayData = await fetchTodayOccurrences()
      setDate(todayData.date)
      setItems(todayData.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오늘 운영 화면을 불러오지 못했습니다.')
    } {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshToday()
  }, [refreshToday])

  const handleSyncToday = async () => {
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

  // 자식 컴포넌트들의 QR 상태 개수를 합산해주는 콜백 (상단 대시보드 동기화용)
  const handleQrCountChange = useCallback((occurrenceId: string, total: number, active: number) => {
    setQrCounts(prev => ({ ...prev, total: prev.total + total, active: prev.active + active }))
  }, [])

  if (loading) {
    return <div style={{ padding: 20 }}>로딩중...</div>
  }

  return (
    <div style={{ padding: 20, display: 'grid', gap: 24 }}>
      <div>
        <h2 style={{ marginBottom: 8 }}>오늘 출석 운영</h2>
        <p style={{ color: '#666', margin: 0 }}>
          오늘 날짜 기준 회차 생성, QR 발급/시간 연장/삭제, 출석 현황을 관리하는 운영 화면입니다.<br />
          매일 새벽 5시에 자동으로 오늘회차가 생성됩니다.<br />
          출석: 시작 1시간전 + 시작시간 + 지각 분 이내,<br/>
          지각: 시작시간 + 지각 분 이후,<br/>
          결석: 수동 결석처리를 권장합니다.<br/><br />
          결석 처리가 되면 출석체크가 불가능합니다.
        </p>
      </div>

      <section style={summaryGridStyle}>
        <SummaryCard title="운영 날짜" value={date || '-'} />
        <SummaryCard title="오늘 회차 수" value={String(items.length)} />
        <SummaryCard title="진행 중 회차" value={String(openCount)} />
        <SummaryCard title="종료 회차" value={String(closedCount)} />
        <SummaryCard title="전체 QR 수" value={String(qrCounts.total)} />
        <SummaryCard title="활성 QR 수" value={String(qrCounts.active)} />
      </section>

      <section style={panelStyle}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => void handleSyncToday()} disabled={syncing} style={primaryButtonStyle}>
            {syncing ? '동기화 중...' : '오늘 회차 동기화'}
          </button>
          <button onClick={() => void refreshToday()} disabled={syncing} style={secondaryButtonStyle}>
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
          items.map((item) => (
            <OccurrenceCard 
              key={item.id} 
              item={item} 
              setGlobalError={setError}
              setGlobalSuccess={setSuccess}
              onQrCountChange={handleQrCountChange}
            />
          ))
        )}
      </section>
    </div>
  )
}

// ==========================================
// 3. 분리된 개별 회차 컴포넌트 (핵심 최적화 포인트)
// ==========================================
interface OccurrenceCardProps {
  item: TodayOccurrenceItem
  setGlobalError: (msg: string) => void
  setGlobalSuccess: (msg: string) => void
  onQrCountChange: (id: string, total: number, active: number) => void
}

function OccurrenceCard({ item, setGlobalError, setGlobalSuccess, onQrCountChange }: OccurrenceCardProps) {
  // 전역 Map 구조에서 격리된 단일 상태 패턴으로 전환
  const [qrs, setQrs] = useState<QrItem[]>([])
  const [attendance, setAttendance] = useState<{ summary: AttendanceSummary; items: AttendanceItem[] }>({
    summary: { total_checked_count: 0, present_count: 0, late_count: 0, absent_count: 0 },
    items: []
  })
  const [missing, setMissing] = useState<{ count: number; items: MissingItem[] }>({ count: 0, items: [] })

  // UI 확장 및 로딩 상태 상태 격리
  const [expanded, setExpanded] = useState(false)
  const [expandedMissing, setExpandedMissing] = useState(false)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [missingLoading, setMissingLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // QR 만료 설정 상태 격리
  const [expireUnit, setExpireUnit] = useState<ExpireUnit>('unlimited')
  const [expireValue, setExpireValue] = useState('0')

  // 초기 자식 데이터 로드
  const fetchQr = useCallback(async () => {
    try {
      const res = await fetch('/api/qr/list', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occurrence_id: item.id }),
      })
      const data = await res.json()
      if (res.ok) {
        const tokens = Array.isArray(data.qr_tokens) ? (data.qr_tokens as QrItem[]) : []
        setQrs(tokens)
        // 상단 요약용 데이터 갱신
        const activeCount = tokens.filter(q => !q.is_expired).length
        onQrCountChange(item.id, tokens.length, activeCount)
      }
    } catch (e) { console.error(e) }
  }, [item.id, onQrCountChange])

  const fetchAttendance = useCallback(async () => {
    setAttendanceLoading(true)
    try {
      const res = await fetch('/api/attendance/by-occurrence', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occurrence_id: item.id }),
      })
      const data = (await res.json()) as AttendanceByOccurrenceResponse
      if (res.ok) {
        setAttendance({
          summary: data.summary ?? { total_checked_count: 0, present_count: 0, late_count: 0, absent_count: 0 },
          items: Array.isArray(data.items) ? data.items : []
        })
      }
    } finally {
      setAttendanceLoading(false)
    }
  }, [item.id])

  const fetchMissing = useCallback(async () => {
    setMissingLoading(true)
    try {
      const res = await fetch('/api/attendance/missing-by-occurrence', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occurrence_id: item.id }),
      })
      const data = (await res.json()) as MissingByOccurrenceResponse
      if (res.ok) {
        setMissing({
          count: Number(data.count ?? 0),
          items: Array.isArray(data.items) ? data.items : []
        })
      }
    } finally {
      setMissingLoading(false)
    }
  }, [item.id])

  useEffect(() => {
    void fetchQr()
    void fetchAttendance()
    void fetchMissing()
  }, [fetchQr, fetchAttendance, fetchMissing])

  // 기존 유효성 검증 로직 유지
  function validateQrExpireSetting(unit: ExpireUnit, val: number) {
    if (unit === 'unlimited') return ''
    if (unit === 'hours') {
      if (!Number.isInteger(val) || val < 1 || val > 6) {
        return '시간 단위 QR 유효시간은 1~6시간 사이 정수입니다. (예: 1, 2, 3)'
      }
      return ''
    }
    if (!Number.isInteger(val) || val < 1 || val > 1) {
      return '일 단위 QR 유효시간은 1일 입니다.'
    }
    return ''
  }

  // QR 복사 및 새창 열기 기능 내부 핸들러화
  const handleCreateQr = async () => {
    const valNum = Number(expireValue)
    const validationError = validateQrExpireSetting(expireUnit, valNum)
    if (validationError) {
      setGlobalError(validationError)
      return
    }

    try {
      setSubmitting(true)
      setGlobalError('')
      setGlobalSuccess('')

      const res = await fetch('/api/qr/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occurrence_id: item.id, expire_unit: expireUnit, expire_value: valNum }),
      })
      const data = (await res.json()) as QrCreateResponse

      if (!res.ok) throw new Error(data.error || 'QR 생성에 실패했습니다.')
      if (!data.qr_url || !data.qr_token) throw new Error('QR 링크가 응답에 없습니다.')

      const nextQr: QrItem = {
        id: data.qr_token.id,
        event_id: data.qr_token.event_id,
        occurrence_id: data.qr_token.occurrence_id,
        token_preview: data.qr_token.token_preview ?? null,
        qr_url: data.qr_url,
        expires_at: data.qr_token.expires_at,
        used_count: data.qr_token.used_count,
        created_at: data.qr_token.created_at,
        is_expired: false,
      }

      setQrs(prev => [nextQr, ...prev])
      setGlobalSuccess(data.message || 'QR이 생성되었습니다.')
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'QR 생성 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyQrLink = async (qrUrl?: string | null) => {
    if (!qrUrl) {
      setGlobalError('이 QR은 원본 링크를 복원할 수 없습니다. 새 QR을 발급해주세요.')
      return
    }
    try {
      await navigator.clipboard.writeText(qrUrl)
      setGlobalSuccess('QR 링크가 복사되었습니다.')
    } catch {
      setGlobalError('QR 링크 복사에 실패했습니다.')
    }
  }

  const handleReissueQr = async (qrId: string) => {
    const valNum = Number(expireValue)
    const validationError = validateQrExpireSetting(expireUnit, valNum)
    if (validationError) {
      setGlobalError(validationError)
      return
    }

    try {
      setSubmitting(true)
      setGlobalError('')
      setGlobalSuccess('')

      const res = await fetch('/api/qr/update', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: qrId, expire_unit: expireUnit, expire_value: valNum }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'QR 시간 연장에 실패했습니다.')

      setGlobalSuccess(data.message || 'QR 유효 시간이 수정되었습니다.')
      void fetchQr()
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'QR 시간 연장 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteQr = async (qrId: string) => {
    if (!window.confirm('정말 이 QR을 삭제하시겠습니까?')) return
    try {
      setSubmitting(true)
      setGlobalError('')
      setGlobalSuccess('')

      const res = await fetch('/api/qr/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: qrId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'QR 삭제에 실패했습니다.')

      setGlobalSuccess(data.message || 'QR이 삭제되었습니다.')
      void fetchQr()
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'QR 삭제 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkAbsent = async () => {
    if (!window.confirm('아직 출석 기록이 없는 수련생들을 결석 처리하시겠습니까?')) return
    try {
      setSubmitting(true)
      setGlobalError('')
      setGlobalSuccess('')

      const res = await fetch('/api/attendance/mark-absent-by-occurrence', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occurrence_id: item.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '결석 처리에 실패했습니다.')

      await Promise.all([fetchAttendance(), fetchMissing()])
      setGlobalSuccess(data.message || `결석 처리 완료: ${Number(data.marked_absent_count ?? 0)}명 처리`)
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : '결석 처리 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const createQrDataUrl = async (qrUrl: string): Promise<string> => {
    const canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, qrUrl, { width: 900, margin: 2, errorCorrectionLevel: 'H' })
    return canvas.toDataURL('image/png')
  }

  const handleOpenQrWindow = async (qrUrl: string) => {
    if (!qrUrl) {
      setGlobalError('QR 링크가 없습니다. 새 QR을 발급해주세요.')
      return
    }
    const popup = window.open('', '_blank', 'width=760,height=860')
    if (!popup) {
      setGlobalError('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.')
      return
    }

    try {
      const qrDataUrl = await createQrDataUrl(qrUrl)
      popup.document.write(`
        <!doctype html>
        <html lang="ko">
          <head><meta charset="UTF-8" /><title>출석 QR 크게보기</title></head>
          <body style="margin:0;padding:24px;background:#111827;color:white;text-align:center;font-family:sans-serif;">
            <h1>출석 QR 크게보기</h1>
            <div style="background:white;padding:16px;border-radius:20px;margin:20px auto;width:min(80vw,600px);height:min(80vw,600px);box-sizing:border-box;">
              <img src="${qrDataUrl}" alt="출석 QR" style="width:100%;height:100%;object-fit:contain;" />
            </div>
            <div style="word-break:break-all;font-size:14px;">${qrUrl}</div>
            <div style="margin-top:20px;">
              <button onclick="navigator.clipboard.writeText('${qrUrl}').then(() => alert('복사되었습니다.'))">링크 복사</button>
              <button onclick="window.close()">닫기</button>
            </div>
          </body>
        </html>
      `)
      popup.document.close()
    } catch {
      setGlobalError('QR 크게보기에 실패했습니다.')
    }
  }

  return (
    <article style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{item.event?.name ?? '알 수 없는 행사'}</div>
          <div style={{ color: '#666', marginTop: 6 }}>회차 날짜: {item.occurrence_date}</div>
          <div style={{ color: '#666', marginTop: 4 }}>시작 시간: {new Date(item.start_time).toLocaleString()}</div>
          <div style={{ color: '#666', marginTop: 4 }}>상태: {formatOccurrenceStatus(item.status)}</div>
          <div style={{ color: '#666', marginTop: 4 }}>
            반복 요일: {formatRecurrenceDays(item.event?.recurrence_days, item.event?.recurrence_type)}
          </div>
          <div style={{ color: '#666', marginTop: 4 }}>
            특별 행사: {item.event?.is_special_event ? '예' : '아니오'} / 지각 기준: {item.event?.late_threshold_min ?? 5}분
          </div>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          {missing.count > 0 && (
            <div style={{ color: '#b91c1c', fontSize: 13 }}>미출석 인원 {missing.count}명이 남아 있습니다.</div>
          )}
          <button onClick={() => void handleMarkAbsent()} disabled={submitting || item.status === 'archived'} style={secondaryButtonStyle}>
            결석 처리
          </button>
        </div>
      </div>

      <section style={attendanceSummarySectionStyle}>
        <div style={attendanceSummaryGridStyle}>
          <MiniSummaryCard title="출석 인원" value={String(attendance.summary.present_count)} />
          <MiniSummaryCard title="지각 인원" value={String(attendance.summary.late_count)} />
          <MiniSummaryCard title="결석 인원" value={String(attendance.summary.absent_count)} />
          <MiniSummaryCard title="미출석 인원" value={String(missing.count)} />
          <MiniSummaryCard title="전체 체크 인원" value={String(attendance.summary.total_checked_count)} />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button onClick={() => void fetchAttendance()} disabled={attendanceLoading || submitting} style={secondaryButtonStyle}>
            {attendanceLoading ? '조회 중...' : '출석 현황 새로고침'}
          </button>
          <button onClick={() => setExpanded(!expanded)} disabled={attendanceLoading} style={secondaryButtonStyle}>
            {expanded ? '출석 상세 닫기' : '출석 상세 보기'}
          </button>
          <button onClick={() => void fetchMissing()} disabled={missingLoading || submitting} style={secondaryButtonStyle}>
            {missingLoading ? '조회 중...' : '미출석 목록 새로고침'}
          </button>
          <button onClick={() => setExpandedMissing(!expandedMissing)} disabled={missingLoading} style={secondaryButtonStyle}>
            {expandedMissing ? '미출석 목록 닫기' : '미출석 목록 보기'}
          </button>
        </div>

        {/* 출석 테이블 상세 */}
        {expanded && (
          <div style={{ marginTop: 14 }}>
            {attendance.items.length === 0 ? (
              <div style={emptyBoxStyle}>출석 상세 데이터가 없습니다.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={thStyle}>이름</th>
                      <th style={thStyle}>학번</th>
                      
                      <th style={thStyle}>상태</th>
                      <th style={thStyle}>방식</th>
                      <th style={thStyle}>체크 시각</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.items.map((att) => (
                      <tr key={att.id}>
                        <td style={tdStyle}>{att.full_name}</td>
                        <td style={tdStyle}>{att.student_id}</td>
                        
                        <td style={tdStyle}>{formatAttendanceStatus(att.status)}</td>
                        <td style={tdStyle}>{att.method ?? '-'}</td>
                        <td style={tdStyle}>{att.check_time ? new Date(att.check_time).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 미출석 테이블 상세 */}
        {expandedMissing && (
          <div style={{ marginTop: 14 }}>
            {missing.items.length === 0 ? (
              <div style={emptyBoxStyle}>미출석 인원이 없습니다.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={thStyle}>이름</th>
                      <th style={thStyle}>학번</th>
                      
                    </tr>
                  </thead>
                  <tbody>
                    {missing.items.map((mis) => (
                      <tr key={mis.id}>
                        <td style={tdStyle}>{mis.full_name}</td>
                        <td style={tdStyle}>{mis.student_id}</td>
                        
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* QR 관리 섹션 */}
      <div style={qrPanelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <h4 style={{ margin: 0 }}>오늘 회차 QR 관리</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(item.status === 'closed' || item.status === 'archived') && (
              <div style={{ color: '#b91c1c', fontSize: 13 }}>종료된 회차는 QR 발급/시간 연장이 제한됩니다.</div>
            )}

            <select
              value={expireUnit}
              onChange={(e) => {
                const nextUnit = e.target.value as ExpireUnit
                setExpireUnit(nextUnit)
                setExpireValue(nextUnit === 'unlimited' ? '0' : '1')
              }}
              style={{ ...inputStyle, width: 140 }}
              disabled={submitting || item.status === 'closed' || item.status === 'archived'}
            >
              <option value="hours">시 단위</option>
              <option value="days">일 단위</option>
              <option value="unlimited">무제한</option>
            </select>

            {expireUnit !== 'unlimited' && (
              <input
                type="number"
                min={1}
                step={1}
                value={expireValue}
                onChange={(e) => setExpireValue(e.target.value)}
                style={{ ...inputStyle, width: 80 }}
                disabled={submitting || item.status === 'closed' || item.status === 'archived'}
              />
            )}

            <button
              onClick={() => void handleCreateQr()}
              disabled={submitting || item.status === 'closed' || item.status === 'archived'}
              style={primaryButtonStyle}
            >
              QR 신규 발급
            </button>
          </div>
        </div>

        {qrs.length === 0 ? (
          <div style={{ ...emptyBoxStyle, background: 'none', border: '1px dashed #e2e8f0' }}>생성된 QR 토큰이 없습니다.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {qrs.map((qr) => (
              <div key={qr.id} style={qrItemRowStyle}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={qr.is_expired ? expiredBadgeStyle : activeBadgeStyle}>
                    {qr.is_expired ? '만료됨' : '유효함'}
                  </span>
                  <code style={{ fontSize: 13, color: '#333' }}>
                    {qr.token_preview ? `${qr.token_preview}...` : qr.id.substring(0, 8)}
                  </code>
                  <span style={{ fontSize: 12, color: '#666' }}>
                    만료시각: {qr.expires_at ? new Date(qr.expires_at).toLocaleString() : '무제한'}
                  </span>
                  <span style={{ fontSize: 12, color: '#666' }}>사용횟수: {qr.used_count}회</span>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => void handleOpenQrWindow(qr.qr_url ?? '')} disabled={qr.is_expired} style={actionButtonStyle}>크게보기</button>
                  <button onClick={() => void handleCopyQrLink(qr.qr_url)} style={actionButtonStyle}>링크복사</button>
                  <button 
                    onClick={() => void handleReissueQr(qr.id)} 
                    disabled={submitting || item.status === 'closed' || item.status === 'archived'} 
                    style={actionButtonStyle}
                  >
                    시간 변경
                  </button>
                  <button onClick={() => void handleDeleteQr(qr.id)} disabled={submitting} style={{ ...actionButtonStyle, color: '#b91c1c' }}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

// ==========================================
// 4. 하위 순수 UI 컴포넌트 및 포맷터 함수 (메모이제이션 방지 불필요 요소)
// ==========================================
function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={summaryCardStyle}>
      <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function MiniSummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={miniSummaryCardStyle}>
      <div style={{ fontSize: 12, color: '#666' }}>{title}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function formatOccurrenceStatus(status: string) {
  if (status === 'scheduled') return '대기 중'
  if (status === 'open') return '진행 중'
  if (status === 'closed') return '종료됨'
  if (status === 'archived') return '기록 보관됨'
  return status
}

function formatRecurrenceDays(days?: WeekdayCode[], type?: 'none' | 'daily') {
  if (type === 'none' || !days || days.length === 0) return '없음(단발성)'
  const koMap: Record<WeekdayCode, string> = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' }
  return days.map((d) => koMap[d]).join(', ')
}

function formatRole(roleName?: string) {
  if (roleName === 'admin') return '관리자'
  if (roleName === 'captain') return '주장'
  if (roleName === 'trainee') return '수련생'
  return roleName ?? '-'
}

function formatAttendanceStatus(status: AttendanceStatus) {
  if (status === 'present') return '✅ 출석'
  if (status === 'late') return '⚠️ 지각'
  if (status === 'absent') return '❌ 결석'
  return status
}

// ==========================================
// 5. 인라인 스타일 가이드 객체
// ==========================================
const summaryGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }
const summaryCardStyle = { background: '#f8fafc', padding: '16px 20px', borderRadius: 12, border: '1px solid #e2e8f0' }
const panelStyle = { background: 'white', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
const attendanceSummarySectionStyle = { background: '#f8fafc', padding: 16, borderRadius: 12, marginTop: 14 }
const attendanceSummaryGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }
const miniSummaryCardStyle = { background: 'white', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' as const }
const qrPanelStyle = { marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }
const qrItemRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 10, background: '#f8fafc', borderRadius: 8, flexWrap: 'wrap' as const }
const inputStyle = { padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }
const tableStyle = { width: '100%', borderCollapse: 'collapse' as const, textAlign: 'left' as const, fontSize: 14, marginTop: 8 }
const thStyle = { padding: 10, borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 600 }
const tdStyle = { padding: 10, borderBottom: '1px solid #e2e8f0', color: '#334155' }
const emptyBoxStyle = { padding: 20, textAlign: 'center' as const, color: '#94a3b8', background: '#f8fafc', borderRadius: 8, fontSize: 14 }
const errorBoxStyle = { padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8, border: '1px solid #fee2e2', fontSize: 14 }
const successBoxStyle = { padding: 12, background: '#f0fdf4', color: '#16a34a', borderRadius: 8, border: '1px solid #dcfce7', fontSize: 14 }
const primaryButtonStyle = { padding: '8px 14px', background: '#1e293b', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }
const secondaryButtonStyle = { padding: '8px 14px', background: 'white', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 6, fontWeight: 500, cursor: 'pointer' }
const actionButtonStyle = { padding: '4px 8px', background: 'white', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12, cursor: 'pointer' }
const activeBadgeStyle = { padding: '2px 6px', background: '#dcfce7', color: '#15803d', borderRadius: 4, fontSize: 12, fontWeight: 600 }
const expiredBadgeStyle = { padding: '2px 6px', background: '#fef2f2', color: '#b91c1c', borderRadius: 4, fontSize: 12, fontWeight: 600 }
// app/admin/admin-only/attendance/monthly/hooks/use-monthly-attendance.ts
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

export type CellStatus = 'present' | 'late' | 'absent' | 'unmarked'

export type MonthlyOccurrence = { 
  id: string; 
  event_id: string; 
  event_name: string; 
  occurrence_date: string; // 형식: 'YYYY-MM-DD'
  start_time: string;
  end_time: string | null; 
  status: string 
}

export type MonthlyAttendanceCell = { 
  occurrence_id: string; 
  event_id: string;
  event_name: string; 
  occurrence_date: string;
  status: CellStatus; 
  attendance_id: string | null; 
  method: string | null; 
  check_time: string | null 
}

export type MonthlyAttendanceUserRow = { 
  profile_id: string; 
  student_id: string; 
  full_name: string; 
  cohort_no: number | null; 
  affiliation_name: string;
  days: Record<string, MonthlyAttendanceCell> 
}

export type MonthlyAttendanceResponse = {
  month: string
  range: { start_date: string; end_date: string }
  filters: { cohort_no: number | null; keyword: string; affiliation_id: string | null }
  summary: { trainee_count: number; occurrence_count: number; present_count: number; late_count: number; absent_count: number; unmarked_count: number }
  occurrences: MonthlyOccurrence[]
  rows: MonthlyAttendanceUserRow[]
}

export type CalendarDay = { date: string; day: number; inCurrentMonth: boolean }
export type DaySummary = { present: number; late: number; absent: number; unmarked: number; disabled: number; total: number; occurrences: MonthlyOccurrence[] }

// 💡 설계에 맞춰 Toggle 속성 타입을 추가 지정합니다.
export type EventOption = { id: string; name: string; toggle: boolean }

function getCurrentMonth(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(new Date())
}

// 💡 안전한 KST 로컬 타임존 기반 캘린더 생성 로직
function buildCalendarDays(month: string): CalendarDay[] {
  if (!month) return []
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1

  const firstDate = new Date(year, monthIndex, 1)
  const lastDate = new Date(year, monthIndex + 1, 0)
  
  const firstWeekday = firstDate.getDay()
  const totalDays = lastDate.getDate()

  const days: CalendarDay[] = []

  // 이전 달 채우기
  for (let i = 0; i < firstWeekday; i++) {
    const prevDate = new Date(year, monthIndex, 1 - firstWeekday + i)
    days.push({
      date: formatDateLocal(prevDate),
      day: prevDate.getDate(),
      inCurrentMonth: false
    })
  }

  // 이번 달 채우기
  for (let day = 1; day <= totalDays; day++) {
    const currDate = new Date(year, monthIndex, day)
    days.push({
      date: formatDateLocal(currDate),
      day,
      inCurrentMonth: true
    })
  }

  // 다음 달 채우기 (7열 그리드 맞추기)
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1]
    const nextDate = new Date(last.date)
    nextDate.setDate(nextDate.getDate() + 1)
    days.push({
      date: formatDateLocal(nextDate),
      day: nextDate.getDate(),
      inCurrentMonth: false
    })
  }
  return days
}

function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function useMonthlyAttendance() {
  const [tempMonth, setTempMonth] = useState<string>(getCurrentMonth)
  const [tempCohortNo, setTempCohortNo] = useState<string>('')
  const [tempKeyword, setTempKeyword] = useState<string>('')
  const [tempAffiliationId, setTempAffiliationId] = useState<string>('')
  
  // 💡 확장된 EventOption[] 타입을 가집니다.
  const [events, setEvents] = useState<EventOption[]>([])

  const [searchParams, setSearchParams] = useState({
    month: getCurrentMonth(),
    cohortNo: '',
    keyword: '',
    affiliationId: '', // 다중 선택 토글 방식을 사용하므로 단일 eventId 상태 필드는 불필요하여 제거합니다.
  })

  const [data, setData] = useState<MonthlyAttendanceResponse | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (searchParams.month) params.set('month', searchParams.month)
    if (searchParams.cohortNo.trim()) params.set('cohort_no', searchParams.cohortNo.trim())
    if (searchParams.keyword.trim()) params.set('keyword', searchParams.keyword.trim())
    if (searchParams.affiliationId.trim()) params.set('affiliation_id', searchParams.affiliationId.trim())
    return params.toString()
  }, [searchParams])

  const calendarDays = useMemo(() => {
    return buildCalendarDays(data?.month || searchParams.month)
  }, [data?.month, searchParams.month])

  const occurrencesByDate = useMemo(() => {
    const map = new Map<string, MonthlyOccurrence[]>()
    if (!data?.occurrences) return map
    for (const occurrence of data.occurrences) {
      const list = map.get(occurrence.occurrence_date) ?? []
      list.push(occurrence)
      map.set(occurrence.occurrence_date, list)
    }
    return map
  }, [data?.occurrences])

  // 💡 데이터베이스 출석 데이터를 날짜별 전체 카운트로 전환하는 강력한 요약 Map 빌더
  const daySummaryMap = useMemo(() => {
    const map = new Map<string, DaySummary>()
    if (!data) return map

    // 1단계: 날짜별 행사 회차 세팅
    for (const occurrence of data.occurrences) {
      if (!map.has(occurrence.occurrence_date)) {
        map.set(occurrence.occurrence_date, { 
          present: 0, 
          late: 0, 
          disabled: 0, // 구 타입 호환성
          absent: 0, 
          unmarked: 0, 
          total: 0, 
          occurrences: [] 
        })
      }
      map.get(occurrence.occurrence_date)!.occurrences.push(occurrence)
    }

    // 2단계: 수련생 로우와 일치하는 회차별 출석 결과를 당일 누적 데이터로 병합
    for (const row of data.rows) {
      for (const occurrence of data.occurrences) {
        const current = map.get(occurrence.occurrence_date)
        if (!current) continue
        
        const cell = row.days[occurrence.id]
        const status = cell?.status ?? 'unmarked'
        
        current[status] += 1
        current.total += 1
      }
    }
    return map
  }, [data])

  const selectedOccurrences = useMemo(() => {
    if (!selectedDate) return []
    return occurrencesByDate.get(selectedDate) ?? []
  }, [occurrencesByDate, selectedDate])

  const selectedRows = useMemo(() => {
    if (!data || !selectedDate || selectedOccurrences.length === 0) return []
    return data.rows.map((row) => {
      const cells = selectedOccurrences.map((occurrence) => {
        const cell = row.days[occurrence.id] ?? null
        return {
          occurrence,
          status: cell?.status ?? 'unmarked',
          check_time: cell?.check_time ?? null,
          method: cell?.method ?? null
        }
      })
      return {
        profile_id: row.profile_id,
        student_id: row.student_id,
        full_name: row.full_name,
        cohort_no: row.cohort_no,
        affiliation_name: row.affiliation_name || '소속 없음',
        cells
      }
    })
  }, [data, selectedDate, selectedOccurrences])

  const loadMonthlyAttendance = async () => {
    try {
      setLoading(true)
      setErrorMessage('')
      const response = await fetch(`/api/admin/attendance/monthly?${queryString}`, { method: 'GET', cache: 'no-store' })
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        setErrorMessage('서버로부터 올바르지 않은 응답을 받았습니다.')
        setData(null)
        return
      }
      const result = await response.json()
      if (!response.ok) {
        setErrorMessage(result?.error || '월별 출석 데이터를 불러오지 못했습니다.')
        setData(null)
        return
      }
      setData(result)
      if (!selectedDate || !result.occurrences.some((item: MonthlyOccurrence) => item.occurrence_date === selectedDate)) {
        setSelectedDate(result.occurrences[0]?.occurrence_date ?? '')
      }
    } catch (error) {
      setErrorMessage('월별 출석 조회 중 오류가 발생했습니다.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  // 💡 이벤트 로드 시 데이터베이스에서 가져온 Toggle 컬럼 상태값을 UI 모델로 매핑합니다.
  const loadEvents = useCallback(async (affiliationId: string) => {
    try {
      const params = new URLSearchParams()
      if (affiliationId.trim()) {
        params.set('affiliation_id', affiliationId.trim())
      }
      const response = await fetch(`/api/events/list?${params.toString()}`, { method: 'GET', cache: 'no-store' })
      if (!response.ok) return
      const result = await response.json()
      const rawEvents = Array.isArray(result?.items) ? result.items : Array.isArray(result) ? result : []
      
      setEvents(rawEvents.map((e: any) => ({ 
        id: String(e.id), 
        name: String(e.name),
        toggle: Boolean(e.toggle) // DB 내의 Toggle bool 컬럼을 맵핑
      })))
    } catch (e) {
      console.error('행사 목록 로드 실패:', e)
    }
  }, [])

  // 💡 사용자 클릭 시 로컬 상태를 우선 업데이트(Optimistic UI)하고, 서버 DB에 즉각 동기화한 뒤 캘린더 데이터를 재조회하는 핵심 액션입니다.
  const toggleEventSelection = useCallback(async (eventId: string, currentToggle: boolean) => {
    const nextToggle = !currentToggle
    
    // 1단계: 즉각적 UI 반응을 위한 선제적 상태 변경
    setEvents((prev) => 
      prev.map((ev) => (ev.id === eventId ? { ...ev, toggle: nextToggle } : ev))
    )

    try {
      // 2단계: Supabase Update API Route 호출
      const response = await fetch('/api/events/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, toggleState: nextToggle })
      })

      if (!response.ok) {
        // 백엔드 통신 실패 시 이전 상태로 되돌림(Rollback)
        setEvents((prev) => 
          prev.map((ev) => (ev.id === eventId ? { ...ev, toggle: currentToggle } : ev))
        )
        const errJson = await response.json().catch(() => ({}))
        setErrorMessage(errJson?.error || '토글 상태 동기화에 실패했습니다.')
        return
      }

      // 3단계: 변경된 토글 상태에 적합한 출석 데이터를 다시 로드
      void loadMonthlyAttendance()
    } catch (err) {
      console.error('[Event Toggle Client Exception]:', err)
      // 예외 발생 시 롤백
      setEvents((prev) => 
        prev.map((ev) => (ev.id === eventId ? { ...ev, toggle: currentToggle } : ev))
      )
    }
  }, [loadMonthlyAttendance])

  const handleAffiliationChange = useCallback((affiliationId: string) => {
    setTempAffiliationId(affiliationId)
    void loadEvents(affiliationId)
  }, [loadEvents])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchParams({
      month: tempMonth,
      cohortNo: tempCohortNo,
      keyword: tempKeyword,
      affiliationId: tempAffiliationId,
    })
  }

  useEffect(() => {
    void loadMonthlyAttendance()
  }, [queryString])

  useEffect(() => {
    void loadEvents('')
  }, [loadEvents])

  return {
    state: {
      tempMonth,
      tempCohortNo,
      tempKeyword,
      tempAffiliationId, // 불필요한 tempEventId 제거
      events,
      loading,
      errorMessage,
      data,
      calendarDays,
      daySummaryMap,
      selectedDate,
      selectedOccurrences,
      selectedRows
    },
    actions: {
      setTempMonth,
      setTempCohortNo,
      setTempKeyword,
      setTempAffiliationId: handleAffiliationChange,
      toggleEventSelection, // 💡 새로 추가된 토글 처리용 핸들러 제공
      handleSearchSubmit,
      setSelectedDate
    }
  }
}
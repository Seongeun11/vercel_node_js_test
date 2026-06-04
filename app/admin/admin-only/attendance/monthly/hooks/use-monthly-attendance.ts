// app/admin/admin-only/attendance/monthly/hooks/use-monthly-attendance.ts
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

export type CellStatus = 'present' | 'late' | 'absent' | 'unmarked'
export type MonthlyOccurrence = { 
  id: string; 
  event_id: string; 
  event_name: string; 
  occurrence_date: string; 
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

const MASTER_AFFILIATIONS = [
  { id: 1, name: '아카데미' },
  { id: 2, name: '영성 40일' },
  { id: 3, name: '모심 40일' },
  { id: 4, name: '효진정' },
  { id: 5, name: '성화영성' },
  { id: 6, name: '3일 공명기도' },
]

export type MonthlyAttendanceResponse = {
  month: string
  range: { start_date: string; end_date: string }
  filters: { cohort_no: number | null; keyword: string; event_id: string | null; affiliation_id: string | null }
  summary: { trainee_count: number; occurrence_count: number; present_count: number; late_count: number; absent_count: number; unmarked_count: number }
  occurrences: MonthlyOccurrence[]
  rows: MonthlyAttendanceUserRow[]
}

export type CalendarDay = { date: string; day: number; inCurrentMonth: boolean }
export type DaySummary = { present: number; late: number; absent: number; unmarked: number; total: number; occurrences: MonthlyOccurrence[] }
export type EventOption = { id: string; name: string }
export type AffiliationOption = { id: string; name: string }

function getCurrentMonth(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(new Date())
}

function buildCalendarDays(month: string): CalendarDay[] {
  if (!month) return []
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1

  const firstDate = new Date(Date.UTC(year, monthIndex, 1))
  const lastDate = new Date(Date.UTC(year, monthIndex + 1, 0))
  const firstWeekday = firstDate.getUTCDay()
  const totalDays = lastDate.getUTCDate()

  const days: CalendarDay[] = []
  for (let i = 0; i < firstWeekday; i += 1) {
    const date = new Date(Date.UTC(year, monthIndex, 1 - firstWeekday + i))
    days.push({ date: date.toISOString().slice(0, 10), day: date.getUTCDate(), inCurrentMonth: false })
  }
  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex, day))
    days.push({ date: date.toISOString().slice(0, 10), day, inCurrentMonth: true })
  }
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1]
    const date = new Date(`${last.date}T00:00:00.000Z`)
    date.setUTCDate(date.getUTCDate() + 1)
    days.push({ date: date.toISOString().slice(0, 10), day: date.getUTCDate(), inCurrentMonth: false })
  }
  return days
}

export function useMonthlyAttendance() {
  const [tempMonth, setTempMonth] = useState<string>(getCurrentMonth)
  const [tempCohortNo, setTempCohortNo] = useState<string>('')
  const [tempKeyword, setTempKeyword] = useState<string>('')
  const [tempEventId, setTempEventId] = useState<string>('')
  const [tempAffiliationId, setTempAffiliationId] = useState<string>('')
  
  const [events, setEvents] = useState<EventOption[]>([])
  const [affiliations, setAffiliations] = useState<AffiliationOption[]>([])

  const [searchParams, setSearchParams] = useState({
    month: getCurrentMonth(),
    cohortNo: '',
    keyword: '',
    eventId: '',
    affiliationId: '',
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
    if (searchParams.eventId.trim()) params.set('event_id', searchParams.eventId.trim())
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

  const daySummaryMap = useMemo(() => {
    const map = new Map<string, DaySummary>()
    if (!data) return map
    for (const occurrence of data.occurrences) {
      if (!map.has(occurrence.occurrence_date)) {
        map.set(occurrence.occurrence_date, { present: 0, late: 0, absent: 0, unmarked: 0, total: 0, occurrences: [] })
      }
      map.get(occurrence.occurrence_date)!.occurrences.push(occurrence)
    }
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

  // 소속 ID 파라미터를 받아 해당 소속에 종속된 행사만 백엔드에서 가져오도록 보완
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
      setEvents(rawEvents.map((e: any) => ({ id: String(e.id), name: String(e.name) })))
    } catch (e) {
      console.error('행사 목록 로드 실패:', e)
    }
  }, [])

  const loadAffiliations = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/affiliations/list', { method: 'GET', cache: 'no-store' })
      if (!response.ok) {
        setAffiliations(MASTER_AFFILIATIONS.map(a => ({ id: String(a.id), name: a.name })))
        return
      }
      const result = await response.json()
      const rawItems = Array.isArray(result) ? result : Array.isArray(result?.items) ? result.items : Array.isArray(result?.data) ? result.data : []
      if (rawItems.length === 0) {
        setAffiliations(MASTER_AFFILIATIONS.map(a => ({ id: String(a.id), name: a.name })))
        return
      }
      const formatted = rawItems.map((item: any) => ({
        id: String(item.id),
        name: String(item.name || item.affiliation_name || `소속 ${item.id}`)
      }))
      setAffiliations(formatted)
    } catch (e) {
      console.error('소속 로드 실패, 마스터 데이터로 대체합니다.', e)
      setAffiliations(MASTER_AFFILIATIONS.map(a => ({ id: String(a.id), name: a.name })))
    }
  }, [])

  // 💡 [논리오류 핵심 교정]: 사용자가 소속을 선택 변경할 때 동적으로 행사 목록을 다시 로딩하는 커스텀 핸들러
  const handleAffiliationChange = useCallback((affiliationId: string) => {
    setTempAffiliationId(affiliationId)
    setTempEventId('') // 소속이 전환되면 이전에 선택한 다른 소속의 행사 ID 바인딩 해제 및 초기화
    void loadEvents(affiliationId) // 변경된 소속 ID에 대응하는 행사 API Re-fetch 유도
  }, [loadEvents])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({
      month: tempMonth,
      cohortNo: tempCohortNo,
      keyword: tempKeyword,
      eventId: tempEventId,
      affiliationId: tempAffiliationId,
    });
  };

  useEffect(() => {
    void loadMonthlyAttendance()
  }, [queryString])

  useEffect(() => {
    void loadAffiliations()
    void loadEvents('') // 최초 페이지 렌더링 시에는 전체 행사 로드
  }, [loadAffiliations, loadEvents])

  return {
    state: {
      tempMonth, tempCohortNo, tempKeyword, tempEventId, tempAffiliationId,
      events, affiliations, loading, errorMessage, data, calendarDays,
      daySummaryMap, selectedDate, selectedOccurrences, selectedRows
    },
    actions: {
      setTempMonth, setTempCohortNo, setTempKeyword, setTempEventId,
      setTempAffiliationId: handleAffiliationChange, // 💡 단순 State 변경 훅을 커스텀 이벤트 처리 핸들러로 스와프
      handleSearchSubmit, setSelectedDate
    }
  }
}
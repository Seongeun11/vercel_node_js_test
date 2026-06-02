//app\admin\[programType]\attendance\monthly\hooks\use-monthly-attendance.ts
'use client'

import { useState, useEffect, useMemo } from 'react'

// 기존 파일의 타입 구조 정의 (생략 없이 내포)
export type CellStatus = 'present' | 'late' | 'absent' | 'unmarked'
export type MonthlyOccurrence = { id: string; event_id: string; event_name: string; occurrence_date: string; start_time: string; end_time: string | null; status: string }
export type MonthlyAttendanceCell = { occurrence_id: string; event_id: string; event_name: string; occurrence_date: string; status: CellStatus; attendance_id: string | null; method: string | null; check_time: string | null }
export type MonthlyAttendanceUserRow = { profile_id: string; student_id: string; full_name: string; cohort_no: number | null; days: Record<string, MonthlyAttendanceCell> }
export type MonthlyAttendanceResponse = { month: string; range: { start_date: string; end_date: string }; filters: { cohort_no: number | null; keyword: string; event_id: string | null }; summary: { trainee_count: number; occurrence_count: number; present_count: number; late_count: number; absent_count: number; unmarked_count: number }; occurrences: MonthlyOccurrence[]; rows: MonthlyAttendanceUserRow[] }
export type CalendarDay = { date: string; day: number; inCurrentMonth: boolean }
export type DaySummary = { present: number; late: number; absent: number; unmarked: number; total: number; occurrences: MonthlyOccurrence[] }
export type EventOption = { id: string; name: string }

function getCurrentMonth(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(new Date())
}

function toDateText(date: Date): string {
  return date.toISOString().slice(0, 10)
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
    days.push({ date: toDateText(date), day: date.getUTCDate(), inCurrentMonth: false })
  }
  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex, day))
    days.push({ date: toDateText(date), day, inCurrentMonth: true })
  }
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1]
    const date = new Date(`${last.date}T00:00:00.000Z`)
    date.setUTCDate(date.getUTCDate() + 1)
    days.push({ date: toDateText(date), day: date.getUTCDate(), inCurrentMonth: false })
  }
  return days
}

// 고정: 인자로 주소창에서 온 소속 코드(currentProgramType)를 넘겨받음
export function useMonthlyAttendance(currentProgramType: string) {
  const [tempMonth, setTempMonth] = useState<string>(getCurrentMonth)
  const [tempCohortNo, setTempCohortNo] = useState<string>('')
  const [tempKeyword, setTempKeyword] = useState<string>('')
  const [tempEventId, setTempEventId] = useState<string>('')
  const [event, setevent] = useState<EventOption[]>([])

  const [searchParams, setSearchParams] = useState({
    month: getCurrentMonth(),
    cohortNo: '',
    keyword: '',
    eventId: '',
  })

  const [data, setData] = useState<MonthlyAttendanceResponse | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()

    // 🚀 [연동 핵심] 현재 타고 온 대시보드의 소속 코드를 쿼리 스트링에 명시적으로 추가
    params.set('program_type', currentProgramType)
    
    params.set('month', searchParams.month)
    if (searchParams.cohortNo.trim()) params.set('cohort_no', searchParams.cohortNo.trim())
    if (searchParams.keyword.trim()) params.set('keyword', searchParams.keyword.trim())
    if (searchParams.eventId.trim()) params.set('event_id', searchParams.eventId.trim())
    return params.toString()
  }, [searchParams])

  // 오류 ① 해결: tempMonth가 아니라 서버에 안착된 data.month 또는 searchParams.month 기준으로 달력을 그림
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
        return { occurrence, status: cell?.status ?? 'unmarked', check_time: cell?.check_time ?? null, method: cell?.method ?? null }
      })
      return { profile_id: row.profile_id, student_id: row.student_id, full_name: row.full_name, cohort_no: row.cohort_no, cells }
    })
  }, [data, selectedDate, selectedOccurrences])

  const loadMonthlyAttendance = async () => {
    try {
      setLoading(true)
      setErrorMessage('')
      const response = await fetch(`/api/admin/attendance/monthly?${queryString}`, { method: 'GET', cache: 'no-store' })
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

  const loadevent = async () => {
    try {
      // 필요에 따라 이벤트 목록 호출 시에도 특정 프로그램의 이벤트군만 필터링하도록 주입 가능
      const response = await fetch(`/api/event/list?program_type=${currentProgramType}`, { method: 'GET', cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) return
      const rawevent = Array.isArray(result?.items) ? result.items : []
      const normalizedevent: EventOption[] = rawevent
        .map((event: any) => ({ id: String(event.id ?? '').trim(), name: String(event.name ?? '이름 없는 행사').trim() }))
        .filter((event: EventOption) => event.id)
      setevent(normalizedevent)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setSearchParams({ month: tempMonth, cohortNo: tempCohortNo, keyword: tempKeyword, eventId: tempEventId })
  }
  useEffect(() => {
  // 🚀 핵심 안전 가드: 
  // 주소창의 programType 변수가 없거나, 공백이거나, 문자열 "undefined"인 상태라면 
  // 백엔드 API 호출을 완전히 생략하고 리턴(대기)합니다.
  if (!currentProgramType || currentProgramType.trim() === '' || currentProgramType === 'undefined') {
    return;
  }

  // 소속 정보가 확실히 로드된 정상적인 상태(예: 'spirituality')에서만 아래 백엔드 API를 호출합니다.
  void loadMonthlyAttendance();
  void loadevent();

}, [queryString, currentProgramType]); // currentProgramType이 변경될 때 다시 체크하도록 의존성 명시
  //useEffect(() => { void loadMonthlyAttendance() }, [queryString])
  //useEffect(() => { void loadevent() }, [])

  return {
    state: { tempMonth, tempCohortNo, tempKeyword, tempEventId, event, loading, errorMessage, data, calendarDays, daySummaryMap, selectedDate, selectedOccurrences, selectedRows },
    actions: { setTempMonth, setTempCohortNo, setTempKeyword, setTempEventId, handleSearch, setSelectedDate }
  }
}
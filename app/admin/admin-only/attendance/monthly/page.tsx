// app/admin/attendance/monthly/page.tsx

'use client'

import { useEffect, useMemo, useState } from 'react'

type CellStatus = 'present' | 'late' | 'absent' | 'unmarked'

type MonthlyOccurrence = {
  id: string
  event_id: string
  event_name: string
  occurrence_date: string
  start_time: string
  end_time: string | null
  status: string
}

type MonthlyAttendanceCell = {
  occurrence_id: string
  event_id: string
  event_name: string
  occurrence_date: string
  status: CellStatus
  attendance_id: string | null
  method: string | null
  check_time: string | null
}

type MonthlyAttendanceUserRow = {
  profile_id: string
  student_id: string
  full_name: string
  cohort_no: number | null
  days: Record<string, MonthlyAttendanceCell>
}

type MonthlyAttendanceResponse = {
  month: string
  range: {
    start_date: string
    end_date: string
  }
  filters: {
    cohort_no: number | null
    keyword: string
    event_id: string | null
  }
  summary: {
    trainee_count: number
    occurrence_count: number
    present_count: number
    late_count: number
    absent_count: number
    unmarked_count: number
  }
  occurrences: MonthlyOccurrence[]
  rows: MonthlyAttendanceUserRow[]
}

type EventOption = {
  id: string
  name: string
}

type CalendarDay = {
  date: string
  day: number
  inCurrentMonth: boolean
}

type DaySummary = {
  present: number
  late: number
  absent: number
  unmarked: number
  total: number
  occurrences: MonthlyOccurrence[]
}

function getCurrentMonth(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
}

function getStatusLabel(status: CellStatus): string {
  switch (status) {
    case 'present':
      return '출석'
    case 'late':
      return '지각'
    case 'absent':
      return '결석'
    case 'unmarked':
      return '미처리'
  }
}

function getStatusStyle(status: CellStatus): React.CSSProperties {
  switch (status) {
    case 'present':
      return {
        color: '#15803d',
        background: '#dcfce7',
        border: '1px solid #86efac',
      }
    case 'late':
      return {
        color: '#b45309',
        background: '#fef3c7',
        border: '1px solid #fcd34d',
      }
    case 'absent':
      return {
        color: '#b91c1c',
        background: '#fee2e2',
        border: '1px solid #fca5a5',
      }
    case 'unmarked':
      return {
        color: '#6b7280',
        background: '#f3f4f6',
        border: '1px solid #e5e7eb',
      }
  }
}

function toDateText(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function buildCalendarDays(month: string): CalendarDay[] {
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1

  const firstDate = new Date(Date.UTC(year, monthIndex, 1))
  const lastDate = new Date(Date.UTC(year, monthIndex + 1, 0))

  // JS getUTCDay(): 일=0, 월=1 ... 토=6
  // 달력도 일요일 시작이므로 그대로 사용
  const firstWeekday = firstDate.getUTCDay()
  const totalDays = lastDate.getUTCDate()

  const days: CalendarDay[] = []

  for (let i = 0; i < firstWeekday; i += 1) {
    const date = new Date(Date.UTC(year, monthIndex, 1 - firstWeekday + i))

    days.push({
      date: toDateText(date),
      day: date.getUTCDate(),
      inCurrentMonth: false,
    })
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex, day))

    days.push({
      date: toDateText(date),
      day,
      inCurrentMonth: true,
    })
  }

  while (days.length % 7 !== 0) {
    const last = days[days.length - 1]
    const date = new Date(`${last.date}T00:00:00.000Z`)

    date.setUTCDate(date.getUTCDate() + 1)

    days.push({
      date: toDateText(date),
      day: date.getUTCDate(),
      inCurrentMonth: false,
    })
  }

  return days
}
function getCellValue(
  row: MonthlyAttendanceUserRow,
  occurrenceId: string
): MonthlyAttendanceCell | null {
  return row.days[occurrenceId] ?? null
}

export default function MonthlyAttendancePage() {
  const [month, setMonth] = useState(getCurrentMonth)
  const [cohortNo, setCohortNo] = useState('')
  const [keyword, setKeyword] = useState('')
  const [eventId, setEventId] = useState('')
  const [events, setEvents] = useState<EventOption[]>([])

  const [data, setData] = useState<MonthlyAttendanceResponse | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()

    params.set('month', month)

    if (cohortNo.trim()) {
      params.set('cohort_no', cohortNo.trim())
    }

    if (keyword.trim()) {
      params.set('keyword', keyword.trim())
    }

    if (eventId.trim()) {
      params.set('event_id', eventId.trim())
    }

    return params.toString()
  }, [month, cohortNo, keyword, eventId])

  const calendarDays = useMemo(() => buildCalendarDays(month), [month])

  const occurrencesByDate = useMemo(() => {
    const map = new Map<string, MonthlyOccurrence[]>()

    for (const occurrence of data?.occurrences ?? []) {
      const list = map.get(occurrence.occurrence_date) ?? []
      list.push(occurrence)
      map.set(occurrence.occurrence_date, list)
    }

    return map
  }, [data])

  const daySummaryMap = useMemo(() => {
    const map = new Map<string, DaySummary>()

    if (!data) return map

    for (const occurrence of data.occurrences) {
      const current = map.get(occurrence.occurrence_date) ?? {
        present: 0,
        late: 0,
        absent: 0,
        unmarked: 0,
        total: 0,
        occurrences: [],
      }

      current.occurrences.push(occurrence)

      for (const row of data.rows) {
        const cell = getCellValue(row, occurrence.id)
        const status = cell?.status ?? 'unmarked'

        current[status] += 1
        current.total += 1
      }

      map.set(occurrence.occurrence_date, current)
    }

    return map
  }, [data])

  const selectedOccurrences = useMemo(() => {
    if (!selectedDate) return []
    return occurrencesByDate.get(selectedDate) ?? []
  }, [occurrencesByDate, selectedDate])

  const selectedRows = useMemo(() => {
    if (!data || !selectedDate) return []

    return data.rows.map((row) => {
      const cells = selectedOccurrences.map((occurrence) => {
        const cell = getCellValue(row, occurrence.id)

        return {
          occurrence,
          status: cell?.status ?? 'unmarked',
          check_time: cell?.check_time ?? null,
          method: cell?.method ?? null,
        }
      })

      return {
        profile_id: row.profile_id,
        student_id: row.student_id,
        full_name: row.full_name,
        cohort_no: row.cohort_no,
        cells,
      }
    })
  }, [data, selectedDate, selectedOccurrences])

  async function loadMonthlyAttendance(): Promise<void> {
    try {
      setLoading(true)
      setErrorMessage('')

      const response = await fetch(`/api/admin/attendance/monthly?${queryString}`, {
        method: 'GET',
        cache: 'no-store',
      })

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
      console.error(error)
      setErrorMessage('월별 출석 조회 중 오류가 발생했습니다.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadEvents(): Promise<void> {
    try {
      const response = await fetch('/api/events/list', {
        method: 'GET',
        cache: 'no-store',
      })

      const result = await response.json()

      if (!response.ok) {
        console.error(result?.error || '행사 목록 조회 실패')
        return
      }

      const rawEvents = Array.isArray(result?.items) ? result.items : []

      const normalizedEvents: EventOption[] = rawEvents
        .map((event: { id?: string; name?: string }) => ({
          id: String(event.id ?? '').trim(),
          name: String(event.name ?? '이름 없는 행사').trim(),
        }))
        .filter((event: EventOption) => event.id)

      setEvents(normalizedEvents)
    } catch (error) {
      console.error('행사 목록 조회 중 오류:', error)
    }
  }

  useEffect(() => {
    void loadMonthlyAttendance()
  }, [queryString])

  useEffect(() => {
    void loadEvents()
  }, [])

  return (
    <main style={{ padding: '24px' }}>
      <section style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '26px' }}>월별 출석관리</h1>
        <p style={{ marginTop: '8px', color: '#666' }}>
          달력에서 날짜를 선택하면 해당 날짜의 출석 상세를 확인할 수 있습니다.
        </p>
      </section>

      <section
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'end',
          marginBottom: '20px',
          padding: '16px',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          background: '#fff',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>월</span>
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            style={{ padding: '9px', border: '1px solid #ccc', borderRadius: '8px' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>기수</span>
          <input
            type="number"
            min={1}
            placeholder="전체"
            value={cohortNo}
            onChange={(event) => setCohortNo(event.target.value)}
            style={{ padding: '9px', border: '1px solid #ccc', borderRadius: '8px', width: '120px' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>검색</span>
          <input
            type="text"
            placeholder="이름 또는 학번"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ padding: '9px', border: '1px solid #ccc', borderRadius: '8px', width: '200px' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>행사</span>
          <select
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            style={{
              padding: '9px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              width: '180px',
              background: '#fff',
            }}
          >
            <option value="">전체 행사</option>

            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => void loadMonthlyAttendance()}
          disabled={loading}
          style={{
            padding: '10px 14px',
            border: 'none',
            borderRadius: '8px',
            background: '#111827',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '조회 중...' : '새로고침'}
        </button>
      </section>

      {errorMessage && (
        <p
          style={{
            padding: '12px',
            borderRadius: '8px',
            background: '#fee2e2',
            color: '#b91c1c',
            fontWeight: 700,
          }}
        >
          ⚠️ {errorMessage}
        </p>
      )}

      {data && (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <SummaryCard title="수련생" value={data.summary.trainee_count} />
            <SummaryCard title="회차" value={data.summary.occurrence_count} />
            <SummaryCard title="출석" value={data.summary.present_count} />
            <SummaryCard title="지각" value={data.summary.late_count} />
            <SummaryCard title="결석" value={data.summary.absent_count} />
            <SummaryCard title="미처리" value={data.summary.unmarked_count} />
          </section>

          <section
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#fff',
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))',
                background: '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              {['일','월', '화', '수', '목', '금', '토'].map((day) => (
                <div
                  key={day}
                  style={{
                    padding: '10px',
                    textAlign: 'center',
                    fontWeight: 800,
                    borderRight: '1px solid #e5e7eb',
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))',
              }}
            >
              {calendarDays.map((day) => {
                const summary = daySummaryMap.get(day.date)
                const isSelected = selectedDate === day.date

                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDate(day.date)}
                    style={{
                      minHeight: '130px',
                      padding: '10px',
                      textAlign: 'left',
                      border: 'none',
                      borderRight: '1px solid #e5e7eb',
                      borderBottom: '1px solid #e5e7eb',
                      background: isSelected
                        ? '#eff6ff'
                        : day.inCurrentMonth
                          ? '#fff'
                          : '#f9fafb',
                      cursor: day.inCurrentMonth ? 'pointer' : 'default',
                      opacity: day.inCurrentMonth ? 1 : 0.45,
                    }}
                    disabled={!day.inCurrentMonth}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px',
                      }}
                    >
                      <strong>{day.day}</strong>
                      {summary && (
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#2563eb',
                            fontWeight: 700,
                          }}
                        >
                          {summary.occurrences.length}회차
                        </span>
                      )}
                    </div>

                    {summary ? (
                      <div style={{ display: 'grid', gap: '4px' }}>
                        <MiniBadge label="출석" value={summary.present} status="present" />
                        <MiniBadge label="지각" value={summary.late} status="late" />
                        <MiniBadge label="결석" value={summary.absent} status="absent" />
                        <MiniBadge label="미처리" value={summary.unmarked} status="unmarked" />
                      </div>
                    ) : (
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                        일정 없음
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          <section
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              background: '#fff',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '20px' }}>
                  {selectedDate || '날짜 미선택'} 상세 출석
                </h2>
                <p style={{ margin: '6px 0 0', color: '#6b7280' }}>
                  선택한 날짜의 행사별 출석 현황입니다.
                </p>
              </div>

              <div style={{ color: '#6b7280', fontSize: '13px' }}>
                {selectedOccurrences.length}개 회차
              </div>
            </div>

            {selectedOccurrences.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>
                선택한 날짜에 회차가 없습니다.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    minWidth: Math.max(760, 330 + selectedOccurrences.length * 120),
                    fontSize: '14px',
                  }}
                >
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <Th width={110}>학번</Th>
                      <Th width={110}>이름</Th>
                      <Th width={80}>기수</Th>

                      {selectedOccurrences.map((occurrence) => (
                        <Th key={occurrence.id} width={140}>
                          <div>{occurrence.event_name}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            {occurrence.start_time?.slice(11, 16) ?? '-'}
                          </div>
                        </Th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {selectedRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3 + selectedOccurrences.length}
                          style={{
                            textAlign: 'center',
                            padding: '32px',
                            color: '#6b7280',
                          }}
                        >
                          조회된 수련생이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      selectedRows.map((row) => (
                        <tr key={row.profile_id}>
                          <Td width={110}>{row.student_id}</Td>
                          <Td width={110}>{row.full_name}</Td>
                          <Td width={80}>{row.cohort_no ?? '-'}</Td>

                          {row.cells.map((cell) => (
                            <Td key={cell.occurrence.id} width={140} center>
                              <span
                                title={cell.check_time ?? ''}
                                style={{
                                  display: 'inline-block',
                                  minWidth: '60px',
                                  padding: '4px 8px',
                                  borderRadius: '999px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  ...getStatusStyle(cell.status),
                                }}
                              >
                                {getStatusLabel(cell.status)}
                              </span>
                            </Td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div
      style={{
        padding: '16px',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        background: '#fff',
      }}
    >
      <div style={{ fontSize: '13px', color: '#6b7280' }}>{title}</div>
      <div style={{ marginTop: '6px', fontSize: '24px', fontWeight: 800 }}>
        {value.toLocaleString()}
      </div>
    </div>
  )
}

function MiniBadge({
  label,
  value,
  status,
}: {
  label: string
  value: number
  status: CellStatus
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '8px',
        padding: '3px 6px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 700,
        ...getStatusStyle(status),
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Th({
  children,
  width,
}: {
  children: React.ReactNode
  width?: number
}) {
  return (
    <th
      style={{
        width,
        minWidth: width,
        background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        borderRight: '1px solid #e5e7eb',
        padding: '10px',
        textAlign: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  width,
  center = false,
}: {
  children: React.ReactNode
  width?: number
  center?: boolean
}) {
  return (
    <td
      style={{
        width,
        minWidth: width,
        borderBottom: '1px solid #e5e7eb',
        borderRight: '1px solid #e5e7eb',
        padding: '10px',
        textAlign: center ? 'center' : 'left',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  )
}
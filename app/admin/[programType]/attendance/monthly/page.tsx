//app\admin\[programType]\attendance\monthly\page.tsx
'use client'
//Next.js의 동적 라우팅 세그먼트(Dynamic Route Segment) 구조를 채택함
import { use } from 'react'
import { useMonthlyAttendance } from './hooks/use-monthly-attendance'
import FilterForm from './components/filter-form'
import StatDashboard from './components/stat-dashboard'
import AttendanceCalendar from './components/attendance-calender'
import DetailTable from './components/detail-table'
interface MonthlyAttendancePageProps {
  // Next.js 15/16 표준 App Router 동적 라우트 params 타입 지정
  params: Promise<{
    programType: string
  }>
}
export default function MonthlyAttendancePage({ params }: MonthlyAttendancePageProps) {
  // 🚀 [논리오류 해결]: 매번 Promise.resolve()를 호출하여 언캐싱된 프로미스를 만들지 않고,
  // Next.js가 주입해준 원본 params 프로미스 그대로를 use()에 전달하여 언랩(Unwrap)합니다.
  const resolvedParams = use(params)
  
  const currentProgramType = resolvedParams?.programType 
    ? String(resolvedParams.programType).trim() 
    : ''

  // 🚀 [해결] 정의된 스펙에 맞게 1개의 인자(소속 코드)를 명시적으로 주입
  const { state, actions } = useMonthlyAttendance(currentProgramType)

  return (
    <main style={{ padding: '24px' }}>
      <section style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '26px' }}>월별 출석관리</h1>
        <p style={{ marginTop: '8px', color: '#666' }}>필터를 선택한 후 검색 버튼을 누르면 달력 정보가 업데이트됩니다.</p>
      </section>

      <FilterForm
        tempMonth={state.tempMonth} tempCohortNo={state.tempCohortNo} tempKeyword={state.tempKeyword} tempEventId={state.tempEventId} event={state.event} loading={state.loading}
        onChangeMonth={actions.setTempMonth} onChangeCohort={actions.setTempCohortNo} onChangeKeyword={actions.setTempKeyword} onChangeEvent={actions.setTempEventId}
        onSubmit={actions.handleSearch}
      />

      {state.errorMessage && (
        <p style={{ padding: '12px', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c', fontWeight: 700 }}>⚠️ {state.errorMessage}</p>
      )}

      {state.data && (
        <>
          <StatDashboard summary={state.data.summary} />
          <AttendanceCalendar calendarDays={state.calendarDays} daySummaryMap={state.daySummaryMap} selectedDate={state.selectedDate} onSelectDate={actions.setSelectedDate} />
          <DetailTable selectedDate={state.selectedDate} selectedOccurrences={state.selectedOccurrences} selectedRows={state.selectedRows} />
        </>
      )}
    </main>
  )
}
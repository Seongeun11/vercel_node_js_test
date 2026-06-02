'use client'

import { useMonthlyAttendance } from './hooks/use-monthly-attendance'
import FilterForm from './components/filter-form'
import StatDashboard from './components/stat-dashboard'
import AttendanceCalendar from './components/attendance-calender'
import DetailTable from './components/detail-table'

export default function MonthlyAttendancePage() {
  const { state, actions } = useMonthlyAttendance()

  return (
    <main style={{ padding: '24px' }}>
      <section style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '26px' }}>월별 출석관리</h1>
        <p style={{ marginTop: '8px', color: '#666' }}>필터를 선택한 후 검색 버튼을 누르면 달력 정보가 업데이트됩니다.</p>
      </section>

      <FilterForm
        tempMonth={state.tempMonth} tempCohortNo={state.tempCohortNo} tempKeyword={state.tempKeyword} tempEventId={state.tempEventId} events={state.events} loading={state.loading}
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
// app/admin/admin-only/attendance/monthly/page.tsx
'use client'

import { useMonthlyAttendance } from './hooks/use-monthly-attendance'
import FilterForm from './components/filter-form'
import StatDashboard from './components/stat-dashboard'
import AttendanceCalendar from './components/attendance-calender'
import DetailTable from './components/detail-table'

export default function MonthlyAttendancePage() {
  const { state, actions } = useMonthlyAttendance()

  return (
    <main style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', background: '#fcfcfd', minHeight: '100vh' }}>
      <header style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: '0 0 6px 0' }}>월별 출석/소속 관리</h1>
        <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>단원들의 월간 출석 현황을 캘린더와 상세 테이블로 조회 및 관리합니다.</p>
      </header>

      {state.errorMessage && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: 500 }}>
          {state.errorMessage}
        </div>
      )}

      {/* 💡 [해결 포인트]: 훅에서 안전하게 받아온 소속 리스트(affiliations)를 FilterForm에 바인딩 */}
      <FilterForm
        tempMonth={state.tempMonth}
        tempCohortNo={state.tempCohortNo}
        tempKeyword={state.tempKeyword}
        tempEventId={state.tempEventId}
        tempAffiliationId={state.tempAffiliationId}
        events={state.events}
        affiliations={state.affiliations}
        loading={state.loading}
        onChangeMonth={actions.setTempMonth}
        onChangeCohort={actions.setTempCohortNo}
        onChangeKeyword={actions.setTempKeyword}
        onChangeEvent={actions.setTempEventId}
        onChangeAffiliation={actions.setTempAffiliationId}
        onSubmit={actions.handleSearchSubmit}
      />

      {state.data?.summary && <StatDashboard summary={state.data.summary} />}

      <AttendanceCalendar
        calendarDays={state.calendarDays}
        daySummaryMap={state.daySummaryMap}
        selectedDate={state.selectedDate}
        onSelectDate={actions.setSelectedDate}
      />

      <DetailTable
        selectedDate={state.selectedDate}
        selectedOccurrences={state.selectedOccurrences}
        selectedRows={state.selectedRows}
      />
    </main>
  )
}
// app/admin/admin-only/attendance/monthly/page.tsx
'use client'

import { useMonthlyAttendance } from './hooks/use-monthly-attendance'
import FilterForm from './components/filter-form'
import AttendanceCalendar from './components/attendance-calender'
import StatDashboard from './components/stat-dashboard'
import DetailTable from './components/detail-table'

export default function MonthlyAttendancePage() {
  const { state, actions } = useMonthlyAttendance()

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '20px' }}>월간 출석 현황 관리</h2>
      
      {/* 필터 폼 */}
      <FilterForm
        tempMonth={state.tempMonth}
        tempCohortNo={state.tempCohortNo}
        tempKeyword={state.tempKeyword}
        tempAffiliationId={state.tempAffiliationId}
        events={state.events}
        loading={state.loading}
        onChangeMonth={actions.setTempMonth}
        onChangeCohort={actions.setTempCohortNo}
        onChangeKeyword={actions.setTempKeyword}
        onChangeAffiliation={actions.setTempAffiliationId}
        onToggleEvent={actions.toggleEventSelection} // 💡 토글 함수 바인딩
        onSubmit={actions.handleSearchSubmit}
      />

      {state.errorMessage && (
        <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: 600 }}>
          {state.errorMessage}
        </div>
      )}

      {/* 통계 대시보드 */}
      {state.data && <StatDashboard summary={state.data.summary} />}

      {/* 월별 캘린더 */}
      <AttendanceCalendar
        calendarDays={state.calendarDays}
        daySummaryMap={state.daySummaryMap}
        selectedDate={state.selectedDate}
        onSelectDate={actions.setSelectedDate}
      />

      {/* 상세 현황 테이블 */}
      <DetailTable
        selectedDate={state.selectedDate}
        selectedOccurrences={state.selectedOccurrences}
        selectedRows={state.selectedRows}
      />
    </div>
  )
}
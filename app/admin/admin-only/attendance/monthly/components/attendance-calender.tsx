// app/admin/admin-only/attendance/monthly/components/attendance-calendar.tsx
'use client'

import { CalendarDay, DaySummary, CellStatus } from '../hooks/use-monthly-attendance'
import { getStatusStyle } from './styles'

interface AttendanceCalendarProps {
  calendarDays: CalendarDay[]
  daySummaryMap: Map<string, DaySummary>
  selectedDate: string
  onSelectDate: (date: string) => void
}

export default function AttendanceCalendar({ calendarDays, daySummaryMap, selectedDate, onSelectDate }: AttendanceCalendarProps) {
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', background: '#fff', marginBottom: '24px' }}>
      {/* 캘린더 요일 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
          <div key={day} style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 800, fontSize: '13px', color: '#374151', borderRight: '1px solid #e5e7eb' }}>
            {day}
          </div>
        ))}
      </div>

      {/* 캘린더 날짜 바디 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))' }}>
        {calendarDays.map((day) => {
          const summary = daySummaryMap.get(day.date)
          const isSelected = selectedDate === day.date

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              disabled={!day.inCurrentMonth}
              style={{
                minHeight: '140px',
                padding: '10px',
                textAlign: 'left',
                border: 'none',
                borderRight: '1px solid #e5e7eb',
                borderBottom: '1px solid #e5e7eb',
                background: isSelected ? '#eff6ff' : day.inCurrentMonth ? '#fff' : '#f9fafb',
                cursor: day.inCurrentMonth ? 'pointer' : 'default',
                opacity: day.inCurrentMonth ? 1 : 0.45,
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              {/* 상단 날짜 및 일정 정보 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: isSelected ? '#2563eb' : '#1f2937' }}>
                  {day.day}
                </span>
                {summary && summary.occurrences.length > 0 && (
                  <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700, background: '#e0f2fe', padding: '2px 6px', borderRadius: '4px' }}>
                    {summary.occurrences.length}회차
                  </span>
                )}
              </div>

              {/* 중하단 출석 통계 뱃지 리스트 */}
              <div style={{ width: '100%' }}>
                {summary && summary.total > 0 ? (
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <MiniBadge label="출석" value={summary.present} status="present" />
                    <MiniBadge label="지각" value={summary.late} status="late" />
                    <MiniBadge label="결석" value={summary.absent} status="absent" />
                    <MiniBadge label="미처리" value={summary.unmarked} status="unmarked" />
                  </div>
                ) : (
                  <div style={{ color: '#9ca3af', fontSize: '11px', textAlign: 'center', marginTop: '16px' }}>
                    일정 없음
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function MiniBadge({ label, value, status }: { label: string; value: number; status: CellStatus }) {
  // 숫자가 0일 때도 흐리게 표시하여 데이터 시인성을 보존하거나 원할 시 숨김 처리할 수 있습니다.
  const style = getStatusStyle(status)
  
  return (
    <div 
      style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '3px 6px', 
        borderRadius: '6px', 
        fontSize: '11px', 
        fontWeight: 700, 
        opacity: value > 0 ? 1 : 0.35, // 0명인 카테고리는 투명도를 높여 중요한 정보에 집중되도록 보완
        ...style 
      }}
    >
      <span>{label}</span>
      <span>{value}명</span>
    </div>
  )
}
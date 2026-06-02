'use client'

import { CalendarDay, DaySummary, CellStatus } from '../hooks/use-monthly-attendance'
import { getStatusStyle } from './styles'

interface AttendanceCalendarProps {
  calendarDays: CalendarDay[]; daySummaryMap: Map<string, DaySummary>; selectedDate: string; onSelectDate: (date: string) => void;
}

export default function AttendanceCalendar({ calendarDays, daySummaryMap, selectedDate, onSelectDate }: AttendanceCalendarProps) {
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', background: '#fff', marginBottom: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
          <div key={day} style={{ padding: '10px', textAlign: 'center', fontWeight: 800, borderRight: '1px solid #e5e7eb' }}>{day}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))' }}>
        {calendarDays.map((day) => {
          const summary = daySummaryMap.get(day.date)
          const isSelected = selectedDate === day.date

          return (
            <button key={day.date} type="button" onClick={() => onSelectDate(day.date)} disabled={!day.inCurrentMonth}
              style={{
                minHeight: '130px', padding: '10px', textAlign: 'left', border: 'none', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
                background: isSelected ? '#eff6ff' : day.inCurrentMonth ? '#fff' : '#f9fafb',
                cursor: day.inCurrentMonth ? 'pointer' : 'default', opacity: day.inCurrentMonth ? 1 : 0.45,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong>{day.day}</strong>
                {summary && <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700 }}>{summary.occurrences.length}회차</span>}
              </div>
              {summary ? (
                <div style={{ display: 'grid', gap: '4px' }}>
                  <MiniBadge label="출석" value={summary.present} status="present" />
                  <MiniBadge label="지각" value={summary.late} status="late" />
                  <MiniBadge label="결석" value={summary.absent} status="absent" />
                  <MiniBadge label="미처리" value={summary.unmarked} status="unmarked" />
                </div>
              ) : (
                <div style={{ color: '#9ca3af', fontSize: '12px' }}>일정 없음</div>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

function MiniBadge({ label, value, status }: { label: string; value: number; status: CellStatus }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '3px 6px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, ...getStatusStyle(status) }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
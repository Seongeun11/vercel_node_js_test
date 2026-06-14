// components\common\data-range-picker.tsx
'use client'

interface DateRangePickerProps {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  onClear?: () => void
}

export default function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear
}: DateRangePickerProps) {
  return (
    <div style={containerStyle}>
      <div style={wrapperStyle}>
        <label style={labelStyle}>조회 기간</label>
        <input
          type="date"
          value={startDate}
          max={endDate || undefined} // 종료일보다 미래 날짜 선택 불가 구조화
          onChange={(e) => onStartDateChange(e.target.value)}
          style={dateInputStyle}
        />
        <span style={dividerStyle}>~</span>
        <input
          type="date"
          value={endDate}
          min={startDate || undefined} // 시작일보다 과거 날짜 선택 불가 구조화
          onChange={(e) => onEndDateChange(e.target.value)}
          style={dateInputStyle}
        />
      </div>
      {onClear && (startDate || endDate) && (
        <button onClick={onClear} style={clearButtonStyle}>
          필터 초기화
        </button>
      )}
    </div>
  )
}

const containerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '12px' }
const wrapperStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 12px', gap: '8px' }
const labelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 600, color: '#475569', marginRight: '4px' }
const dateInputStyle: React.CSSProperties = { border: 'none', outline: 'none', color: '#334155', fontSize: '14px', cursor: 'pointer' }
const dividerStyle: React.CSSProperties = { color: '#94a3b8', fontWeight: 600 }
const clearButtonStyle: React.CSSProperties = { padding: '6px 12px', background: '#f1f5f9', border: 'none', borderRadius: '6px', fontSize: '13px', color: '#64748b', cursor: 'pointer' }
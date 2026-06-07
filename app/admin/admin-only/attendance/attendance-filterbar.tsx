//app\admin\admin-only\attendance\attendance-filterbar.tsx
'use client'

import AffiliationSelect from '@/components/common/affiliation-select'

interface AttendanceFilterBarProps {
  currentDate: string
  onDateChange: (date: string) => void
  selectedAffiliationId: string
  onAffiliationChange: (id: string) => void
  totalCount: number
}

export default function AttendanceFilterBar({
  currentDate,
  onDateChange,
  selectedAffiliationId,
  onAffiliationChange,
  totalCount
}: AttendanceFilterBarProps) {
  return (
    <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* 날짜 필터 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>📅 조회 일자 선택 :</span>
          <input
            type="date"
            value={currentDate}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '14px' }}
          />
        </div>

        {/* 소속 공용 필터 및 카운트 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label htmlFor="affiliation-filter" style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
            🔍 소속 필터 :
          </label>
          <AffiliationSelect 
            value={selectedAffiliationId} 
            onChange={onAffiliationChange} 
          />
          {selectedAffiliationId && (
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              검색 결과: <strong>{totalCount}</strong>명
            </span>
          )}
        </div>

      </div>
    </div>
  )
}
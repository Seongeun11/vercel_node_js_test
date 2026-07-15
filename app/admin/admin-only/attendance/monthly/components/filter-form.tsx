// app/admin/admin-only/attendance/monthly/components/filter-form.tsx
'use client'

import { EventOption } from '../hooks/use-monthly-attendance'
// 공용 컴포넌트 임포트
import AffiliationSelect from '@/components/common/affiliation-select'

interface FilterFormProps {
  tempMonth: string;
  tempCohortNo: string;
  tempKeyword: string;
  tempAffiliationId: string;
  events: EventOption[];
  loading: boolean;
  onChangeMonth: (v: string) => void;
  onChangeCohort: (v: string) => void;
  onChangeKeyword: (v: string) => void;
  onToggleEvent: (eventId: string, currentToggle: boolean) => void; // 단일 선택 핸들러 대신 다중 토글 핸들러로 교체
  onChangeAffiliation: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function FilterForm({
  tempMonth,
  tempCohortNo,
  tempKeyword,
  tempAffiliationId,
  events = [],
  loading,
  onChangeMonth,
  onChangeCohort,
  onChangeKeyword,
  onToggleEvent,
  onChangeAffiliation,
  onSubmit
}: FilterFormProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fff' }}>
      
      {/* 1. 기본 검색 필터 영역 */}
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>월</span>
          <input 
            type="month" 
            value={tempMonth} 
            onChange={(e) => onChangeMonth(e.target.value)} 
            style={{ padding: '9px', border: '1px solid #ccc', borderRadius: '8px' }} 
          />
        </label>
        
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>소속</span>
          <AffiliationSelect 
            value={tempAffiliationId} 
            onChange={onChangeAffiliation}
            showAllOption={true}
            allOptionLabel="전체 소속"
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>기수</span>
          <input 
            type="number" 
            min={1} 
            placeholder="전체" 
            value={tempCohortNo} 
            onChange={(e) => onChangeCohort(e.target.value)} 
            style={{ padding: '9px', border: '1px solid #ccc', borderRadius: '8px', width: '120px' }} 
          />
        </label>
        
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700 }}>검색</span>
          <input 
            type="text" 
            placeholder="이름 또는 학번" 
            value={tempKeyword} 
            onChange={(e) => onChangeKeyword(e.target.value)} 
            style={{ padding: '9px', border: '1px solid #ccc', borderRadius: '8px', width: '200px' }} 
          />
        </label>
        
        <button 
          type="submit" 
          disabled={loading} 
          style={{ 
            padding: '10px 20px', 
            border: 'none', 
            borderRadius: '8px', 
            background: '#2563eb', 
            color: '#fff', 
            fontWeight: 700, 
            cursor: loading ? 'not-allowed' : 'pointer', 
            opacity: loading ? 0.6 : 1 
          }}
        >
          {loading ? '조회 중...' : '검색'}
        </button>
      </form>

      {/* 2. 다중 토글 행사 리스트 영역 (색상 구분을 매우 명확하게 개선) */}
      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
        <span style={{ fontSize: '13.5px', fontWeight: 800, display: 'block', marginBottom: '10px', color: '#374151' }}>
          캘린더 표시 행사 토글 (필터링할 행사를 선택하세요)
        </span>
        
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {events.length === 0 ? (
            <span style={{ fontSize: '12.5px', color: '#9ca3af', padding: '6px 0' }}>해당하는 행사가 없습니다.</span>
          ) : (
            events.map((ev) => {
              const isActive = ev.toggle ?? false;
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onToggleEvent(ev.id, isActive)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '30px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    
                    // 💡 [핵심 개선] 토글 ON / OFF 일 때의 드라마틱한 색상 분리
                    border: isActive ? '2px solid #1d4ed8' : '1px solid #d1d5db',
                    background: isActive ? '#2563eb' : '#f3f4f6', // ON: 선명한 파란색 / OFF: 부드러운 회색 배경
                    color: isActive ? '#ffffff' : '#4b5563',      // ON: 흰색 글씨 / OFF: 어두운 회색 글씨
                    
                    // ON 상태일 때 그림자를 주어 입체감 부여
                    boxShadow: isActive ? '0 4px 6px -1px rgba(37, 99, 235, 0.25), 0 2px 4px -1px rgba(37, 99, 235, 0.15)' : 'none',
                  }}
                  // 마우스 호버 시 자연스럽게 반응하게 세팅
                  onMouseEnter={(e) => {
                    const target = e.currentTarget;
                    if (!isActive) {
                      target.style.background = '#e5e7eb';
                      target.style.color = '#1f2937';
                    } else {
                      target.style.background = '#1d4ed8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const target = e.currentTarget;
                    if (!isActive) {
                      target.style.background = '#f3f4f6';
                      target.style.color = '#4b5563';
                    } else {
                      target.style.background = '#2563eb';
                    }
                  }}
                >
                  {/* 시각적 아이콘 표시 변경 */}
                  <span style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: isActive ? '#ffffff' : '#e5e7eb',
                    color: isActive ? '#2563eb' : '#9ca3af',
                    fontSize: '10px',
                    fontWeight: 900
                  }}>
                    {isActive ? '✓' : '＋'}
                  </span>
                  <span>{ev.name}</span>
                </button>
              )
            })
          )}
        </div>
      </div>

    </div>
  )
}
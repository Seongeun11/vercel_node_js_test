//app\admin\[programType]\attendance\monthly\components\filter-form.tsx
'use client'

import { EventOption } from '../hooks/use-monthly-attendance'

interface FilterFormProps {
  tempMonth: string; tempCohortNo: string; tempKeyword: string; tempEventId: string; event: EventOption[]; loading: boolean;
  onChangeMonth: (v: string) => void; onChangeCohort: (v: string) => void; onChangeKeyword: (v: string) => void; onChangeEvent: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function FilterForm({
  tempMonth, tempCohortNo, tempKeyword, tempEventId, event, loading,
  onChangeMonth, onChangeCohort, onChangeKeyword, onChangeEvent, onSubmit
}: FilterFormProps) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end', marginBottom: '20px', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fff' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700 }}>월</span>
        <input type="month" value={tempMonth} onChange={(e) => onChangeMonth(e.target.value)} style={{ padding: '9px', border: '1px solid #ccc', borderRadius: '8px' }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700 }}>기수</span>
        <input type="number" min={1} placeholder="전체" value={tempCohortNo} onChange={(e) => onChangeCohort(e.target.value)} style={{ padding: '9px', border: '1px solid #ccc', borderRadius: '8px', width: '120px' }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700 }}>검색</span>
        <input type="text" placeholder="이름 또는 학번" value={tempKeyword} onChange={(e) => onChangeKeyword(e.target.value)} style={{ padding: '9px', border: '1px solid #ccc', borderRadius: '8px', width: '200px' }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700 }}>행사</span>
        <select value={tempEventId} onChange={(e) => onChangeEvent(e.target.value)} style={{ padding: '9px', border: '1px solid #ccc', borderRadius: '8px', width: '180px', background: '#fff' }}>
          <option value="">전체 행사</option>
          {event.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </label>
      <button type="submit" disabled={loading} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
        {loading ? '조회 중...' : '검색'}
      </button>
    </form>
  )
}
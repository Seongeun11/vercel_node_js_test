//app\admin\[programType]\attendance\monthly\components\detail-table.tsx
'use client'

import { MonthlyOccurrence } from '../hooks/use-monthly-attendance'
import { getStatusLabel, getStatusStyle, toKstTime } from './styles'

interface DetailTableProps {
  selectedDate: string; selectedOccurrences: MonthlyOccurrence[]; selectedRows: any[];
}

export default function DetailTable({ selectedDate, selectedOccurrences, selectedRows }: DetailTableProps) {
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px' }}>{selectedDate || '날짜 미선택'} 상세 출석</h2>
          <p style={{ margin: '6px 0 0', color: '#6b7280' }}>선택한 날짜의 행사별 출석 현황입니다.</p>
        </div>
        <div style={{ color: '#6b7280', fontSize: '13px' }}>{selectedOccurrences.length}개 회차</div>
      </div>

      {selectedOccurrences.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280' }}>선택한 날짜에 회차가 없습니다.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: Math.max(760, 330 + selectedOccurrences.length * 120), fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <Th width={110}>학번</Th>
                <Th width={110}>이름</Th>
                <Th width={80}>기수</Th>
                {selectedOccurrences.map((occ) => (
                  <Th key={occ.id} width={140}>
                    <div>{occ.event_name}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{toKstTime(occ.start_time)}</div>
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedRows.length === 0 ? (
                <tr>
                  <td colSpan={3 + selectedOccurrences.length} style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>조회된 수련생이 없습니다.</td>
                </tr>
              ) : (
                selectedRows.map((row) => (
                  <tr key={row.profile_id}>
                    <Td width={110}>{row.student_id}</Td>
                    <Td width={110}>{row.full_name}</Td>
                    <Td width={80}>{row.cohort_no ?? '-'}</Td>
                    {row.cells.map((cell: any) => (
                      <Td key={cell.occurrence.id} width={140} center>
                        <span title={cell.check_time ?? ''} style={{ display: 'inline-block', minWidth: '60px', padding: '4px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, ...getStatusStyle(cell.status) }}>
                          {getStatusLabel(cell.status)}
                        </span>
                      </Td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Th({ children, width }: { children: React.ReactNode; width?: number }) {
  return <th style={{ width, minWidth: width, background: '#f9fafb', borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', padding: '10px', textAlign: 'center', whiteSpace: 'nowrap' }}>{children}</th>
}

//@ts-ignore
function Td({ children, width, center = false }: { children: React.ReactNode; width?: number; center?: boolean }) {
  return <td style={{ width, minWidth: width, borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', padding: '10px', textAlign: center ? 'center' : 'left', whiteSpace: 'nowrap' }}>{children}</td>
}
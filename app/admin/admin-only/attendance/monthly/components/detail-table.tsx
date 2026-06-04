// app/admin/admin-only/attendance/monthly/components/detail-table.tsx
'use client'

import React from 'react'
import { MonthlyOccurrence } from '../hooks/use-monthly-attendance'

interface SelectedRowData {
  profile_id: string
  student_id: string
  full_name: string
  cohort_no: number | null
  affiliation_name: string
  cells: {
    occurrence: MonthlyOccurrence
    status: 'present' | 'late' | 'absent' | 'unmarked'
    check_time: string | null
    method: string | null
  }[]
}

interface DetailTableProps {
  selectedDate: string
  selectedOccurrences: MonthlyOccurrence[]
  selectedRows: SelectedRowData[]
}

export default function DetailTable({ selectedDate, selectedOccurrences, selectedRows }: DetailTableProps) {
  if (!selectedDate || selectedRows.length === 0) return null
  const minTableWidth = Math.max(760, 440 + selectedOccurrences.length * 120)

  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1f2937' }}>
          일별 상세 출석 현황 ({selectedDate})
        </h3>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: minTableWidth, tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <Th width={110}>학번</Th>
              <Th width={110}>이름</Th>
              <Th width={130}>소속</Th>
              <Th width={90}>기수</Th>
              {selectedOccurrences.map((occ) => (
                <Th key={occ.id} width={120}>{occ.event_name}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selectedRows.map((row) => (
              <tr key={row.profile_id} style={{ borderBottom: '1px solid #e5e7eb', transition: 'background 0.15s' }}>
                <Td style={{ color: '#4b5563', fontFamily: 'monospace' }}>{row.student_id}</Td>
                <Td style={{ fontWeight: 600, color: '#111827' }}>{row.full_name}</Td>
                <Td style={{ color: '#2563eb', fontWeight: 500 }}>{row.affiliation_name || '소속 없음'}</Td>
                <Td>{row.cohort_no ? `${row.cohort_no}기` : '-'}</Td>
                {row.cells.map((cell, idx) => {
                  const badgeStyle = getStatusBadgeStyle(cell.status)
                  return (
                    <Td key={idx} style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, backgroundColor: badgeStyle.bg, color: badgeStyle.text }}>
                        {badgeStyle.label}
                      </span>
                    </Td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Th({ children, width }: { children: React.ReactNode; width?: number }) {
  return (
    <th style={{ width: width ? `${width}px` : 'auto', padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#4b5563', textAlign: 'left', borderRight: '1px solid #f3f4f6' }}>
      {children}
    </th>
  )
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', ...style }}>
      {children}
    </td>
  )
}

function getStatusBadgeStyle(status: 'present' | 'late' | 'absent' | 'unmarked') {
  switch (status) {
    case 'present': return { bg: '#dcfce7', text: '#15803d', label: '출석' }
    case 'late': return { bg: '#fef9c3', text: '#a16207', label: '지각' }
    case 'absent': return { bg: '#fee2e2', text: '#b91c1c', label: '결석' }
    case 'unmarked': default: return { bg: '#f3f4f6', text: '#4b5563', label: '미체크' }
  }
}
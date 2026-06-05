//app\admin\admin-only\attendance-today\attendance-tables.tsx
'use client'

import React from 'react';
import { AttendanceItem, MissingItem } from './types';

// 포맷터 함수 포함
export function formatAttendanceStatus(status: string) {
  if (status === 'present') return '✅ 출석';
  if (status === 'late') return '⚠️ 지각';
  if (status === 'absent') return '❌ 결석';
  return status;
}

interface AttendanceTableProps {
  items: AttendanceItem[];
}

export function AttendanceDetailTable({ items }: AttendanceTableProps) {
  if (items.length === 0) {
    return <div style={emptyBoxStyle}>출석 상세 데이터가 없습니다.</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={thStyle}>이름</th>
            <th style={thStyle}>학번</th>
            <th style={thStyle}>상태</th>
            <th style={thStyle}>방식</th>
            <th style={thStyle}>체크 시각</th>
          </tr>
        </thead>
        <tbody>
          {items.map((att) => (
            <tr key={att.id}>
              <td style={tdStyle}>{att.full_name}</td>
              <td style={tdStyle}>{att.student_id}</td>
              <td style={tdStyle}>{formatAttendanceStatus(att.status)}</td>
              <td style={tdStyle}>{att.method ?? '-'}</td>
              <td style={tdStyle}>{att.check_time ? new Date(att.check_time).toLocaleString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface MissingTableProps {
  items: MissingItem[];
}

export function MissingDetailTable({ items }: MissingTableProps) {
  if (items.length === 0) {
    return <div style={emptyBoxStyle}>미출석 인원이 없습니다.</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={thStyle}>이름</th>
            <th style={thStyle}>학번</th>
          </tr>
        </thead>
        <tbody>
          {items.map((mis) => (
            <tr key={mis.id}>
              <td style={tdStyle}>{mis.full_name}</td>
              <td style={tdStyle}>{mis.student_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 스타일 객체
const tableStyle = { width: '100%', borderCollapse: 'collapse' as const, textAlign: 'left' as const, fontSize: 14, marginTop: 8 };
const thStyle = { padding: 10, borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 600 };
const tdStyle = { padding: 10, borderBottom: '1px solid #e2e8f0', color: '#334155' };
const emptyBoxStyle = { padding: 20, textAlign: 'center' as const, color: '#94a3b8', background: '#f8fafc', borderRadius: 8, fontSize: 14 };
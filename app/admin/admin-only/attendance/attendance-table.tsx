//app\admin\admin-only\attendance\attendance-table.tsx
'use client'

import { AttendanceManageItem, AttendanceStatus } from './types/attendance'

interface AttendanceTableProps {
  items: AttendanceManageItem[]
  onOpenEditModal: (item: AttendanceManageItem) => void
}

const styles = {
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px', marginTop: '12px' },
  th: { padding: '12px', textAlign: 'left' as const, borderBottom: '2px solid #e2e8f0', background: '#f8fafc', fontWeight: 600, color: '#475569' },
  td: { padding: '12px', borderBottom: '1px solid #e2e8f0' },
  selectInput: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '13px' },
  badge: (status: AttendanceStatus) => {
    const config = {
      present: { bg: '#dcfce7', text: '#16a34a' },
      late: { bg: '#fef3c7', text: '#d97706' },
      absent: { bg: '#fecdd3', text: '#e11d48' }
    }
    return {
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 600,
      background: config[status]?.bg ?? '#f1f5f9',
      color: config[status]?.text ?? '#64748b',
    }
  },
  actionBtn: { padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }
}
const statusLabel: Record<AttendanceStatus, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
}
export default function AttendanceTable({ items, onOpenEditModal }: AttendanceTableProps) {
  return (
    <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>학번 / 고유키</th>
            <th style={styles.th}>성명</th>
            <th style={styles.th}>소속 정보</th>
            <th style={styles.th}>연동 행사</th>
            <th style={styles.th}>체크 시간</th>
            <th style={styles.th}>인식 수단</th>
            <th style={styles.th}>현재 상태</th>
            <th style={styles.th}>원격 조치</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={styles.td}>{item.user?.student_id ?? '미지정'}</td>
              <td style={{ ...styles.td, fontWeight: 700 }}>{item.user?.full_name ?? '알 수 없는 사용자'}</td>
              <td style={{ ...styles.td, color: '#2563eb', fontWeight: 500 }}>{item.event?.affiliation_name ?? '소속없음'}</td>
              <td style={styles.td}>{item.event?.name ?? '삭제된 행사'}</td>
              <td style={styles.td}>{item.check_time ? new Date(item.check_time).toLocaleTimeString() : '-'}</td>
              <td style={styles.td}>
                <span style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                  {item.method}
                </span>
              </td>
              <td style={styles.td}>
                <span style={styles.badge(item.status)}>{item.status}</span>
              </td>
              <td
  style={{
    ...styles.td,
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  }}
>
  <span
    style={{
      fontSize: '13px',
      fontWeight: 600,
      color: '#64748b',
      minWidth: '60px',
    }}
  >
    {statusLabel[item.status]}
  </span>
                <button style={styles.actionBtn} onClick={() => onOpenEditModal(item)}>
                  출결 수정
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
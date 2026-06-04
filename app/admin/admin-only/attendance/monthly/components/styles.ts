// app/admin/admin-only/attendance/monthly/components/styles.ts
import { CellStatus } from '../hooks/use-monthly-attendance'

export function getStatusLabel(status: CellStatus): string {
  switch (status) {
    case 'present': return '출석'
    case 'late': return '지각'
    case 'absent': return '결석'
    case 'unmarked': return '미처리'
  }
}

export function getStatusStyle(status: CellStatus): React.CSSProperties {
  switch (status) {
    case 'present': return { color: '#15803d', background: '#dcfce7', border: '1px solid #86efac' }
    case 'late': return { color: '#b45309', background: '#fef3c7', border: '1px solid #fcd34d' }
    case 'absent': return { color: '#b91c1c', background: '#fee2e2', border: '1px solid #fca5a5' }
    case 'unmarked': return { color: '#6b7280', background: '#f3f4f6', border: '1px solid #e5e7eb' }
  }
}

export function toKstTime(value: string): string {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
  } catch (e) {
    return ''
  }
}
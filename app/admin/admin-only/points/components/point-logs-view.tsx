// app/admin/admin-only/points/components/PointLogsView.tsx
'use client'

import { useEffect } from 'react'
import { useAdminPointLogs } from '../hooks/use-admin-point-logs'
import DateRangePicker from '@/components/common/data-range-picker'

export default function PointLogsView() {
  const {
    logs,
    loading,
    localStartDate,
    localEndDate,
    setLocalStartDate,
    setLocalEndDate,
    triggerSearch,
    clearFilter,
    fetchLogs
  } = useAdminPointLogs()

  // 💡 [논리 점검 완료] 날짜 데이터 변경 시 자동 연쇄 호출을 중단하고 
  // 오직 triggerSearch에 의해 파라미터 묶음(searchParams)이 최종 변경되었을 때만 데이터 정산 호출이 동작함
  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <div style={filterPanelStyle}>
        {/* 달력을 바꿀 때는 내부 로컬 버퍼(localState)만 스무스하게 변경됨 */}
        <DateRangePicker
          startDate={localStartDate}
          endDate={localEndDate}
          onStartDateChange={setLocalStartDate}
          onEndDateChange={setLocalEndDate}
          onClear={clearFilter}
        />
        {/* 💡 [수정 구역] 이 버튼을 누르는 순간 비로소 서버 패치 쿼리가 해방(Trigger)됩니다 */}
        <button 
          onClick={triggerSearch} 
          disabled={loading} 
          style={refreshButtonStyle}
        >
          {loading ? '검색 중...' : '조건 검색'}
        </button>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr style={headerRowStyle}>
            <th>일시</th><th>대상 수련생</th><th>변동액</th><th>구분</th><th>정산 후 잔액</th><th>상세 사유</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                선택하신 기간 내의 포인트 로그가 존재하지 않습니다.
              </td>
            </tr>
          ) : (
            logs.map(log => (
              <tr key={log.id} style={rowStyle}>
                <td>{new Date(log.created_at).toLocaleString('ko-KR')}</td>
                <td style={{ fontWeight: 600 }}>{log.user_name || '미확인'}</td>
                <td style={{ color: log.action === 'cancel' ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                  {log.action === 'cancel' ? '-' : '+'}{log.amount.toLocaleString()} P
                </td>
                <td><span style={actionBadgeStyle(log.action)}>{log.action}</span></td>
                <td style={{ fontWeight: 600 }}>{log.balance_after_action.toLocaleString()} P</td>
                <td style={{ fontSize: '12px', color: '#64748b' }}>{log.reason}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// 스타일 정의 구조 보존
const filterPanelStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', fontSize: '13px' }
const headerRowStyle: React.CSSProperties = { background: '#f1f5f9', textAlign: 'left', borderBottom: '2px solid #e2e8f0', padding: '12px' }
const rowStyle: React.CSSProperties = { borderBottom: '1px solid #f1f5f9' }
const refreshButtonStyle: React.CSSProperties = { padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'background 0.2s' }
const actionBadgeStyle = (action: string): React.CSSProperties => ({
  padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
  background: action === 'admin_adjust' ? '#dcfce7' : action === 'cancel' ? '#fee2e2' : '#f1f5f9',
  color: action === 'admin_adjust' ? '#166534' : action === 'cancel' ? '#991b1b' : '#475569'
})
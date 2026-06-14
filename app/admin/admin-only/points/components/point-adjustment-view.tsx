// app/admin/admin-only/points/components/PointAdjustmentView.tsx
'use client'

import { useState } from 'react'
import AffiliationSelect from '@/components/common/affiliation-select'
import { AdminUser } from '../../users/hooks/use-admin-users'

// 💡 [교정] AdminUser 타입을 확장하여 포인트 관련 필드를 필수/옵셔널로 명시합니다.
interface PointAdminUser extends AdminUser {
  current_points?: number
  affiliation_id?: string | number
}

interface Props {
  users: PointAdminUser[] // 💡 확장된 타입을 사용하도록 변경
  loading: boolean
  affiliationMap: Record<string, string>
  onRefresh: () => void
  onAdjust: (userId: string, isIncrement: boolean, amount: string, reason: string) => Promise<boolean>
}

export default function PointAdjustmentView({ users, loading, affiliationMap, onRefresh, onAdjust }: Props) {
  const [filterAffId, setFilterAffId] = useState('')
  const [filterEnroll, setFilterEnroll] = useState('active')
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({})
  const [reasonInputs, setReasonInputs] = useState<Record<string, string>>({})

  // 필터링 로직
  const filteredUsers = users.filter((u) => {
    if (filterEnroll !== 'all' && u.enrollment_status !== filterEnroll) return false
    if (filterAffId) {
      const uAffId = String((u as any).affiliation_id || '')
      if (uAffId !== filterAffId) return false
    }
    return true
  })

  const handleAction = async (userId: string, isPlus: boolean) => {
    const success = await onAdjust(userId, isPlus, amountInputs[userId], reasonInputs[userId])
    if (success) {
      setAmountInputs(prev => ({ ...prev, [userId]: '' }))
      setReasonInputs(prev => ({ ...prev, [userId]: '' }))
    }
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <div style={filterBarStyle}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <select value={filterEnroll} onChange={(e) => setFilterEnroll(e.target.value)} style={selectStyle}>
            <option value="active">재학생</option>
            <option value="completed">수료생</option>
            <option value="all">학적 전체</option>
          </select>
          <AffiliationSelect value={filterAffId} onChange={setFilterAffId} showAllOption allOptionLabel="소속 전체" />
        </div>
        <button onClick={onRefresh} disabled={loading} style={refreshButtonStyle}>
          {loading ? '동기화 중...' : '목록 새로고침'}
        </button>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr style={headerRowStyle}>
            <th>학번</th><th>이름</th><th>소속</th><th>보유 포인트</th><th>조정 패널</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map(user => (
            <tr key={user.id} style={rowStyle}>
              <td>{user.student_id}</td>
              <td style={{ fontWeight: 600 }}>{user.full_name}</td>
              <td>{String((user as any).affiliation?.name || (user as any).affiliation || '미지정')}</td>
              <td style={{ color: '#2563eb', fontWeight: 700 }}>{user.current_points?.toLocaleString()} P</td>
              <td style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input 
                  placeholder="사유 입력 (필수)" 
                  value={reasonInputs[user.id] || ''} 
                  onChange={e => setReasonInputs(p => ({...p, [user.id]: e.target.value}))}
                  style={inputReasonStyle}
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input 
                    type="number" placeholder="액수" 
                    value={amountInputs[user.id] || ''} 
                    onChange={e => setAmountInputs(p => ({...p, [user.id]: e.target.value}))}
                    style={inputAmountStyle} 
                  />
                  <button onClick={() => handleAction(user.id, true)} style={plusBtnStyle}>+</button>
                  <button onClick={() => handleAction(user.id, false)} style={minusBtnStyle}>-</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// 스타일 상수는 기존 스타일 재사용 (간략화)
const filterBarStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#f8fafc', borderRadius: '8px', marginBottom: '16px' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', overflow: 'hidden' }
const headerRowStyle: React.CSSProperties = { background: '#f1f5f9', textAlign: 'left', fontSize: '13px' }
const rowStyle: React.CSSProperties = { borderBottom: '1px solid #f1f5f9' }
const selectStyle: React.CSSProperties = { padding: '6px 12px', borderRadius: '4px', border: '1px solid #e2e8f0' }
const refreshButtonStyle: React.CSSProperties = { padding: '6px 12px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }
const inputReasonStyle: React.CSSProperties = { padding: '4px 8px', fontSize: '12px', border: '1px solid #e2e8f0', borderRadius: '4px' }
const inputAmountStyle: React.CSSProperties = { width: '60px', padding: '4px', border: '1px solid #e2e8f0' }
const plusBtnStyle: React.CSSProperties = { background: '#16a34a', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px' }
const minusBtnStyle: React.CSSProperties = { background: '#dc2626', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px' }
// app/admin/admin-only/points/page.tsx
'use client'

import { useState, useEffect } from 'react'
import AdminHeader from '@/components/admin/AdminHeader'
import { useAdminPoints } from './hooks/use-admin-points'
import PointAdjustmentView from './components/point-adjustment-view'
import PointLogsView from './components/point-logs-view'

export default function AdminPointsPage() {
  const [activeTab, setActiveTab] = useState<'adjust' | 'logs'>('adjust')
  const [affiliationMap, setAffiliationMap] = useState<Record<string, string>>({})
  const { users, loading, fetchUsersWithPoints, adjustPoint, message, errorMessage } = useAdminPoints()

  useEffect(() => {
    async function fetchMeta() {
      const res = await fetch('/api/affiliations').then(r => r.json())
      if (res.success) {
        const dict: Record<string, string> = {}
        res.data.forEach((i: any) => dict[String(i.id)] = i.name)
        setAffiliationMap(dict)
      }
    }
    fetchMeta()
    fetchUsersWithPoints()
  }, [fetchUsersWithPoints])

  const handleAdjust = async (userId: string, isPlus: boolean, amount: string, reason: string) => {
    const val = Math.floor(Number(amount))
    if (!amount || isNaN(val) || val <= 0) { alert('유효한 금액을 입력하세요.'); return false }
    if (!reason.trim()) { alert('사유를 입력하세요.'); return false }

    return await adjustPoint({
      target_user_id: userId,
      amount: isPlus ? val : -val,
      action_type: isPlus ? 'admin_adjust' : 'cancel',
      reason: reason.trim()
    })
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <AdminHeader title="포인트 종합 관리" description="수련생 포인트 정산 및 변동 이력을 추적합니다." />

      {/* 전문적인 탭 네비게이션 */}
      <div style={tabContainerStyle}>
        <button onClick={() => setActiveTab('adjust')} style={tabButtonStyle(activeTab === 'adjust')}>
          포인트 실시간 변경
        </button>
        <button onClick={() => setActiveTab('logs')} style={tabButtonStyle(activeTab === 'logs')}>
          포인트 변동 로그
        </button>
      </div>

      {message && <p style={{ color: '#16a34a', margin: '10px 0' }}>✓ {message}</p>}
      {errorMessage && <p style={{ color: '#dc2626', margin: '10px 0' }}>✗ {errorMessage}</p>}

      {activeTab === 'adjust' ? (
        <PointAdjustmentView 
          users={users} loading={loading} affiliationMap={affiliationMap}
          onRefresh={fetchUsersWithPoints} onAdjust={handleAdjust} 
        />
      ) : (
        <PointLogsView />
      )}
    </div>
  )
}

const tabContainerStyle: React.CSSProperties = { display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', marginBottom: '20px', marginTop: '20px' }
const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
  padding: '10px 20px', cursor: 'pointer', border: 'none', background: 'none',
  fontSize: '15px', fontWeight: 600, color: isActive ? '#2563eb' : '#64748b',
  borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent',
  transition: 'all 0.2s'
})
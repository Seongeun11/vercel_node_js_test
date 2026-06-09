//app\attendance\point-requests\my-point-requests-client.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { useRouter } from 'next/navigation'

interface UserProfile {
  id: string
  full_name: string
  student_id: string
  current_points: number
}

interface UsageRequest {
  id: string
  store_name: 'goods' | 'cafe' // [추가] 상점 필드 타입 정의
  product_name: string
  points_requested: number
  status: 'pending' | 'approved' | 'rejected' 
  created_at: string
}

export default function MyPointUsageRequestsClient() {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null) 
  const [requests, setRequests] = useState<UsageRequest[]>([])
  
  // 입력 폼 상태 관리
  const [storeName, setStoreName] = useState<'goods' | 'cafe' | ''>('') // [추가] 상점 선택 유지를 위한 state
  const [productName, setProductName] = useState('')
  const [pointsRequested, setPointsRequested] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // 유저 정보 및 본인의 포인트 요청 이력 조회
  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // 1) 프로필 잔여 포인트 실시간 조회 
    const { data: profile } = await supabase
      .from('profiles') 
      .select('id, full_name, student_id, current_points')
      .eq('id', session.user.id)
      .single()

    if (profile) setUser(profile)

    // 2) 신청 내역 조회 (store_name 컬럼 추가)
    const { data: reqList } = await supabase
      .from('point_usage_requests')
      .select('id, store_name, product_name, points_requested, status, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (reqList) setRequests(reqList as UsageRequest[])
  }

  useEffect(() => {
    loadData() 
  }, [])

  // 포인트 결제 사용 신청 제출 (INSERT)
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // 상점 선택 정밀 검증
    if (!storeName) {
      alert('이용하실 상점(천심굿즈 또는 천심카페)을 상단에서 먼저 선택해 주세요.')
      return
    }

    const pts = parseInt(pointsRequested, 10)
    if (!productName.trim() || isNaN(pts) || pts <= 0) { 
      alert('올바른 상품명과 차감할 포인트를 입력해 주세요.') 
      return
    }

    setLoading(true)
    setMessage('')

    try {
      // [보안 강화 - 2차 방어]: 요청 제출 시점에 DB에서 실시간 최신 포인트 잔액 재조회 
      const { data: latestProfile, error: profileCheckErr } = await supabase
        .from('profiles')
        .select('current_points')
        .eq('id', user.id)
        .single() 

      if (profileCheckErr || !latestProfile) {
        throw new Error('사용자 계정 상태를 확인할 수 없습니다.')
      }

      if (latestProfile.current_points < pts) {
        alert(`잔여 포인트가 부족합니다.\n현재 실시간 보유 포인트: ${latestProfile.current_points.toLocaleString()} p`); 
        setUser(prev => prev ? { ...prev, current_points: latestProfile.current_points } : null) 
        setLoading(false)
        return
      }

      // 검증 통과 후 장부에 인서트 요청 진행 (store_name 매핑 추가) 
      const { error: insertError } = await supabase
        .from('point_usage_requests')
        .insert({
          user_id: user.id, 
          store_name: storeName, // 'goods' 또는 'cafe'
          product_name: productName.trim(), 
          points_requested: pts, 
          status: 'pending' 
        })

      if (insertError) throw insertError

      setMessage('포인트 결제 요청이 전송되었습니다. 해당 상점의 승인을 기다려주세요.')
      setProductName('')
      setPointsRequested('')
      setStoreName('') // 초기화
      await loadData() 

    } catch (error: any) {
      setMessage(`요청 실패: ${error.message || '알 수 없는 오류가 발생했습니다.'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', fontFamily: 'sans-serif' }}>
      <button 
        onClick={() => router.push('/')}
        style={{ marginBottom: '20px', padding: '8px 14px', cursor: 'pointer', borderRadius: '6px', border: '1px solid #ccc', background: '#fff' }}
      >
        🏠 메인 화면으로 가기 
      </button>
      
      <h2 style={{ marginBottom: '8px' }}>🛒 아카데미 포인트 사용 요청</h2> 
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>방문하신 상점과 상품 정보를 올바르게 입력해 주세요.</p>
      
      {user && (
        <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '10px', border: '1px solid #e9ecef', marginBottom: '24px' }}>
          <p style={{ margin: '0 0 6px 0', fontSize: '15px' }}><strong>신청 계정:</strong> {user.full_name} ({user.student_id})</p>
          <p style={{ margin: 0, color: '#0070f3', fontSize: '20px', fontWeight: 'bold' }}>
            나의 잔여 포인트: {user.current_points.toLocaleString()} p 
          </p>
        </div>
      )}

      {/* 결제 요청 입력 폼 */}
      <form onSubmit={handleSubmitRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '36px', background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #eee'  }}>
        
        {/* 상점 선택 UI 컴포넌트 세그먼트 */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
            이용 상점 선택 <span style={{ color: '#d93025' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setStoreName('goods')}
              style={{
                flex: 1, padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s',
                border: storeName === 'goods' ? '2px solid #0070f3' : '1px solid #ccc',
                background: storeName === 'goods' ? '#e8f0fe' : '#fff',
                color: storeName === 'goods' ? '#1a73e8' : '#333'
              }}
            >
              🎁 천심굿즈
            </button>
            <button
              type="button"
              onClick={() => setStoreName('cafe')}
              style={{
                flex: 1, padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s',
                border: storeName === 'cafe' ? '2px solid #0070f3' : '1px solid #ccc',
                background: storeName === 'cafe' ? '#e8f0fe' : '#fff',
                color: storeName === 'cafe' ? '#1a73e8' : '#333'
              }}
            >
              ☕ 천심카페
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>구매 상품명</label>
          <input 
            type="text" 
            placeholder="예: 딸기우유, 홀카티 등" 
            value={productName}
            onChange={(e) => setProductName(e.target.value)} 
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
            required
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>사용할 포인트액 (숫자만)</label>
          <input  
            type="number" 
            placeholder="예: 2500" 
            value={pointsRequested}
            onChange={(e) => setPointsRequested(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
            required
          /> 
        </div>
        <button 
          type="submit" 
          disabled={loading} 
          style={{ padding: '12px', background: '#0070f3', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
        >
          {loading ? '전송 처리 중...' : '포인트 결제 요청 생성'}
        </button>
      </form>

      {message && (
        <div style={{ padding: '12px', borderRadius: '6px', background: '#e8f0fe', color: '#1a73e8', fontWeight: '500', marginBottom: '20px', fontSize: '14px' }}>
          {message}
        </div>
      )}

      {/* 개인 결제 내역 히스토리 그리드 */}
      <h3 style={{ marginBottom: '12px' }}>📋 나의 결제 요청 상태</h3> 
      <div style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead style={{ background: '#f8f9fa' }}>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '10px 12px' }}>대상 상점</th>
              <th style={{ padding: '10px 12px' }}>상품명</th> 
              <th style={{ padding: '10px 12px' }}>요청 포인트</th> 
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>상태</th> 
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>
                  {req.store_name === 'goods' ? '🎁 굿즈' : '☕ 카페'}
                </td>
                <td style={{ padding: '12px' }}>{req.product_name}</td> 
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{req.points_requested.toLocaleString()} p</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', 
                    backgroundColor: req.status === 'approved' ? '#e6f4ea' : req.status === 'rejected' ? '#fce8e6' : '#fef7e0', 
                    color: req.status === 'approved' ? '#137333' : req.status === 'rejected' ? '#c5221f' : '#b06000' 
                  }}>
                    {req.status === 'pending' ? '대기중' : req.status === 'approved' ? '승인완료' : '반려됨'} 
                  </span>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>결제 요청 내역이 존재하지 않습니다.</td> 
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
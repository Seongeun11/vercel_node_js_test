// app/admin/point-requests/point-requests-client.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { useRouter } from 'next/navigation'

interface PendingRequest {
  id: string
  store_name: 'goods' | 'cafe'
  points_requested: number
  product_name: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  user_id: string 
  profiles: {
    full_name: string
    student_id: string
    current_points: number
  } | null 
}

export default function RequestsClient() {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()
  
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [processingId, setProcessingId] = useState<string | null>(null) 
  
  const [myAssignedStore, setMyAssignedStore] = useState<'goods' | 'cafe' | null>(null)
  const [captainName, setCaptainName] = useState<string>('')

  // 1) 로그인 세션을 통해 해당 Captain 아이디의 프로필(이름) 정보 확인 및 상점 매핑
  const identifyCaptainAndLoad = async () => {
    const { data: { session } } = await supabase.auth.getSession() 
    if (!session) return

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', session.user.id)
      .single()

    if (error || !profile) {
      console.error('관리자 프로필 확인 불가:', error)
      return
    }

    setCaptainName(profile.full_name)

    let storeKey: 'goods' | 'cafe' | null = null
    if (profile.full_name.includes('천심굿즈')) { 
      storeKey = 'goods'
    } else if (profile.full_name.includes('천심카페')) { 
      storeKey = 'cafe'
    }

    if (storeKey) {
      setMyAssignedStore(storeKey)
      fetchAssignedRequests(storeKey)
    }
  }

  // 2) 자신에게 소속된 상점 장부 수신
  const fetchAssignedRequests = async (store: 'goods' | 'cafe') => {
    const { data, error } = await supabase
      .from('point_usage_requests')
      .select(`
        id, 
        store_name,
        points_requested, 
        product_name, 
        status,
        created_at, 
        user_id,
        profiles:user_id ( 
          full_name, 
          student_id, 
          current_points 
        )
      `)
      .eq('store_name', store) 
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[browser] 대기 장부 수신 오류:', error)
    } else {
      setRequests(data as unknown as PendingRequest[]) 
    }
  }

  useEffect(() => {
    identifyCaptainAndLoad()
  }, [])

  // [완벽 교정] 포인트 결제 승인 핵심 트랜잭션 함수
  const handleApprove = async (req: PendingRequest) => {
    if (!req.profiles) {
      alert('요청자의 프로필 정보가 없어 승인할 수 없습니다.');
      return;
    }

    if (myAssignedStore !== req.store_name) {
      alert('본인의 담당 상점 요청 건만 제어할 수 있습니다.');
      return;
    }

    const storeTitle = req.store_name === 'goods' ? '천심굿즈' : '천심카페';
    if (!window.confirm(`[${storeTitle}] ${req.profiles.full_name}님의 ${req.product_name} (${req.points_requested}p) 결제를 승인하시겠습니까?`)) return;

    setProcessingId(req.id);
    const { data: { session } } = await supabase.auth.getSession();
    const captainId = session?.user?.id;

    try {
      // 1. 최신 포인트 정보 다시 실시간 베이스 조회
      const { data: latestProfile, error: fetchErr } = await supabase
        .from('profiles')
        .select('current_points')
        .eq('id', req.user_id)
        .single();

      if (fetchErr) throw new Error(`유저의 최신 포인트를 조회할 수 없습니다. RLS를 확인하세요.`);

      const currentPoints = latestProfile ? latestProfile.current_points : req.profiles.current_points;

      if (currentPoints < req.points_requested) { 
        alert('유저의 잔여 아카데미 포인트가 부족하여 승인 처리가 거절되었습니다.');
        setProcessingId(null);
        return;
      }

      const nextBalance = currentPoints - req.points_requested;

      // 2. 사용자 프로필 포인트 차감 실행 및 수정 결과 강제 반환(select) 설정
      const { data: updateResult, error: profileErr } = await supabase
        .from('profiles')
        .update({ current_points: nextBalance })
        .eq('id', req.user_id)
        .select(); // 💡 중요: 수정한 행의 데이터를 다시 반환받도록 처리하여 RLS 차단 우회 여부 감시

      if (profileErr) throw profileErr;
      
      // RLS 권한 부족으로 인해 업데이트가 씹혔을 경우 방어막 작동
      if (!updateResult || updateResult.length === 0) {
        throw new Error("데이터베이스 권한(RLS Update Policy) 부족으로 학생 포인트 차감이 실패했습니다. SQL Editor 설정을 확인하세요.");
      }

      // 3. 회계 장부인 point_logs 원장 테이블에 이력 영구 기록
      const { error: logErr } = await supabase
        .from('point_logs') 
        .insert({
          user_id: req.user_id, 
          amount: req.points_requested,      
          action: 'use_shop',                 
          actor_id: captainId,                
          reason: `[${storeTitle} 결제 승인] ${req.product_name}`,
          balance_after_action: nextBalance   
        });

      if (logErr) throw logErr;

      // 4. 임시 승인 대기 레코드 상태 및 처리자 마킹 변경
      const { error: requestErr } = await supabase
        .from('point_usage_requests')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: captainId
        })
        .eq('id', req.id);

      if (requestErr) throw requestErr;

      alert(`성공적으로 ${storeTitle} 결제건이 승인 마감되었습니다.`); 
      
      // 5. 현재 할당된 상점 상태값 유실 방지하며 목록 새로고침
      const activeStore = myAssignedStore || req.store_name;
      if (activeStore) {
        fetchAssignedRequests(activeStore);
      }

    } catch (err: any) {
      console.error('승인 트랜잭션 에러 리포트:', err);
      alert(`승인 처리 중 오류 발생: ${err.message || err}`); 
    } finally {
      setProcessingId(null);
    }
  };

  // 결제 반려(거절) 집행 함수
  const handleReject = async (id: string) => {
    if (!window.confirm('이 결제 요청을 반려(거절) 처리하시겠습니까?')) return
    
    setProcessingId(id)
    const { error } = await supabase
      .from('point_usage_requests')
      .update({ status: 'rejected' })
      .eq('id', id)

    setProcessingId(null)

    if (error) {
      alert('반려 처리에 실패했습니다: ' + error.message) 
    } else {
      alert('반려 처리가 정상 집행되었습니다.')
      if (myAssignedStore) fetchAssignedRequests(myAssignedStore)
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px', fontFamily: 'sans-serif' }}>
      <button 
        onClick={() => router.push('/')}
        style={{ marginBottom: '20px', padding: '8px 14px', cursor: 'pointer', borderRadius: '6px', border: '1px solid #ccc', background: '#fff' }}
      >
        🏠 메인으로 
      </button>
      
      <h2>🔑 포인트 승인 센터 ({myAssignedStore === 'goods' ? '🎁 천심굿즈' : myAssignedStore === 'cafe' ? '☕ 천심카페' : '인증 대기중'})</h2>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '24px' }}>
        접속자: <strong>{captainName || '관리자'}</strong>님 계정으로 배정된 상점 실시간 내역만 표시됩니다. 
      </p>

      <div style={{ border: '1px solid #e9ecef', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead style={{ background: '#f1f3f5' }}>
            <tr style={{ borderBottom: '1px solid #dee2e6' }}>
              <th style={{ padding: '12px' }}>담당 소속</th>
              <th style={{ padding: '12px' }}>요청자명(학번)</th>
              <th style={{ padding: '12px' }}>요청 품목</th> 
              <th style={{ padding: '12px' }}>차감 포인트</th>
              <th style={{ padding: '12px' }}>유저 현재 잔액</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>상태 / 제어</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req.id} style={{ borderBottom: '1px solid #eee', backgroundColor: req.status === 'rejected' ? '#fdf2f2' : req.status === 'approved' ? '#f3faf4' : '#fff' }}>
                <td style={{ padding: '14px 12px', fontWeight: 'bold', color: '#0070f3' }}>
                  {req.store_name === 'goods' ? '🎁 굿즈' : '☕ 카페'}
                </td>
                <td style={{ padding: '14px 12px' }}>
                  {req.profiles ? (
                    <>
                      <strong>{req.profiles.full_name}</strong> 
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}> 
                        {req.profiles.student_id} 
                      </div>
                    </>
                  ) : (
                    <span style={{ color: '#ea4335', fontSize: '12px' }}>유저 정보 없음</span>
                  )}
                </td>
                <td style={{ padding: '14px 12px', fontWeight: '500' }}>{req.product_name}</td>
                <td style={{ padding: '14px 12px', color: '#d93025', fontWeight: 'bold' }}>
                  -{req.points_requested.toLocaleString()} p 
                </td>
                <td style={{ padding: '14px 12px', color: '#495057' }}>
                  {req.profiles ? `${req.profiles.current_points.toLocaleString()} p` : '0 p'} 
                </td>
                <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                  {req.status === 'pending' ? (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button 
                        onClick={() => handleApprove(req)} 
                        disabled={processingId !== null}
                        style={{ padding: '6px 12px', background: '#137333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                      >
                        {processingId === req.id ? '처리중' : '승인'} 
                      </button>
                      <button 
                        onClick={() => handleReject(req.id)}
                        disabled={processingId !== null}
                        style={{ padding: '6px 12px', background: '#dee2e6', color: '#212529', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                      >
                        반려
                      </button>
                    </div>
                  ) : (
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                      backgroundColor: req.status === 'approved' ? '#e6f4ea' : '#fce8e6',
                      color: req.status === 'approved' ? '#137333' : '#c5221f'
                    }}>
                      {req.status === 'approved' ? '승인완료' : '반려됨'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#adb5bd', fontSize: '15px' }}>
                  현재 결제 승인을 기다리는 포인트 대기 건이 존재하지 않습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
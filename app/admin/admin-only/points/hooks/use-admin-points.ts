//app\admin\admin-only\points\hooks\use-admin-points.ts
'use client'

import { useState, useCallback } from 'react'
import { AdminUser } from '../../users/hooks/use-admin-users'

export function useAdminPoints() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')

  // 🔄 회원 명부 데이터 패치 함수
  const fetchUsersWithPoints = useCallback(async () => {
    setLoading(true)
    setMessage('')
    setErrorMessage('')
    try {
      const res = await fetch('/api/profiles/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        throw new Error(`서버 응답 실패 (상태코드: ${res.status})`)
      }

     const result = await res.json()
    let extractedList: AdminUser[] = []

    if (result) {
    if (Array.isArray(result.users)) {
        // 백엔드가 반환하는 { users: [...] } 형태를 정확하게 가로채 파싱합니다.
        extractedList = result.users 
    } else if (Array.isArray(result.data)) {
        extractedList = result.data
    } else if (Array.isArray(result)) {
        extractedList = result
    }
    }

    if (Array.isArray(extractedList)) {
    setUsers(extractedList)
    } else {
    setErrorMessage('회원 목록 데이터 규격이 올바르지 않습니다.')
    }
        } catch (err) {
        console.error('[useAdminPoints] Critical Load Error:', err)
        setErrorMessage('서버에서 회원 데이터를 가져오지 못했습니다. 권한이나 세션을 점검해 주세요.')
        } finally {
        setLoading(false)
        }
    }, [])

  // 🪙 포인트 트랜잭션 요청 모듈
  // use-admin-points.ts 내부 adjustPoint 함수 파라미터 타입 수정
    const adjustPoint = async (payload: {
    target_user_id: string
    amount: number
    action_type: 'earn_bonus' | 'admin_adjust' | 'use_shop' | 'cancel'  // 'cancel' 등 차감용 액션 추가 정의 가능
    reason: string
    }) => {
    setMessage('')
    setErrorMessage('')
    try {
      const res = await fetch('/api/admin/points/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      
      if (!res.ok) {
        const errorResult = await res.json().catch(() => ({ error: '포인트 서버 내부 에러가 발생했습니다.' }))
        setErrorMessage(errorResult.error || '포인트 실시간 반영에 실패했습니다.')
        return false
      }

      const result = await res.json()
      setMessage(result.message || '포인트 변동 이력이 안전하게 반영되었습니다.')
      
      setUsers((prev) =>
        prev.map((u) =>
          u.id === payload.target_user_id
            ? { ...u, current_points: result.current_points ?? ((u as any).current_points + payload.amount) }
            : u
        )
      )
      return true
    } catch (err) {
      console.error('[useAdminPoints] Adjust Point Network Exception:', err)
      setErrorMessage('네트워크 연결 상태가 올바르지 않습니다.')
      return false
    }
  }

  return {
    users,
    loading,
    message,
    errorMessage,
    setMessage,
    setErrorMessage,
    fetchUsersWithPoints,
    adjustPoint,
  }
}
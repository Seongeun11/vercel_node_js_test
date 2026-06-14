// app/admin/admin-only/points/hooks/use-admin-point-logs.ts
'use client'

import { useState, useCallback, useEffect } from 'react'

export interface PointLog {
  id: string
  user_id: string
  user_name?: string
  amount: number
  action: string
  reason: string
  balance_after_action: number
  created_at: string
}

// 💡 [Helper 함수] 한국 시간대(KST) 규격에 맞춘 날짜 포맷터 함수 규칙 수립
function getKSTDateStrings() {
  const now = new Date()
  // 한국 표준시(UTC+9) 보정 계산
  const kstOffset = 9 * 60 * 60 * 1000
  const kstDate = new Date(now.getTime() + kstOffset)
  
  const yyyy = kstDate.getUTCFullYear()
  const mm = String(kstDate.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(kstDate.getUTCDate()).padStart(2, '0')
  
  return {
    firstDay: `${yyyy}-${mm}-${dd}`, // 해당 월의 매 1일 자동 연산
    today: `${yyyy}-${mm}-${dd}`   // 오늘 날짜 자동 연산
  }
}

export function useAdminPointLogs() {
  const [logs, setLogs] = useState<PointLog[]>([])
  const [loading, setLoading] = useState(false)
  
  // 💡 [논리 교정] 캘린더 UI의 상태(버퍼)와 실제 API 호출의 트리거용 상태를 이원화 분리
  const [localStartDate, setLocalStartDate] = useState('')
  const [localEndDate, setLocalEndDate] = useState('')
  const [searchParams, setSearchParams] = useState({ startDate: '', endDate: '' })

  // 컴포넌트 마운트 시 최초 1회 자동으로 매월 1일과 오늘 날짜 할당 로직 가동
  useEffect(() => {
    const { firstDay, today } = getKSTDateStrings()
    setLocalStartDate(firstDay)
    setLocalEndDate(today)
    setSearchParams({ startDate: firstDay, endDate: today })
  }, [])

  const fetchLogs = useCallback(async () => {
    // 초기 마운트 시 버퍼 세팅 전 조기 차단 방어선
    if (!searchParams.startDate && !searchParams.endDate) return

    setLoading(true)
    try {
      let url = '/api/admin/points/logs'
      const query = new URLSearchParams()
      
      // 💡 [의존성 격리] 사용자가 마우스로 만지는 로컬 버퍼가 아닌, 오직 확정된 searchParams로만 요청
      if (searchParams.startDate) query.append('startDate', searchParams.startDate)
      if (searchParams.endDate) query.append('endDate', searchParams.endDate)
      
      const queryString = query.toString()
      if (queryString) url += `?${queryString}`

      const res = await fetch(url, { method: 'GET', cache: 'no-store' })
      if (!res.ok) throw new Error(`서버 에러 발생 (Status: ${res.status})`)
      
      const result = await res.json()
      setLogs(result.data || [])
    } catch (err: any) {
      console.error('로그 조회 실패:', err.message || err)
    } finally {
      setLoading(false)
    }
  }, [searchParams]) // 💡 오직 검색 버튼 클릭에 의해 searchParams가 변경될 때만 훅이 갱신됨

  // 💡 [검색 버튼 전용 트리거 논리 엔진]
  const triggerSearch = () => {
    setSearchParams({
      startDate: localStartDate,
      endDate: localEndDate
    })
  }

  const clearFilter = () => {
    const { firstDay, today } = getKSTDateStrings()
    setLocalStartDate(firstDay)
    setLocalEndDate(today)
    setSearchParams({ startDate: firstDay, endDate: today })
  }

  return {
    logs,
    loading,
    localStartDate,
    localEndDate,
    setLocalStartDate,
    setLocalEndDate,
    triggerSearch,
    clearFilter,
    fetchLogs
  }
}
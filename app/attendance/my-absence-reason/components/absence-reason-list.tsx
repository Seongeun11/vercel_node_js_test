'use client'

import React, { useState, useEffect, useCallback } from 'react'

export type AbsenceType = {
  id: number
  text: string
}

export type AbsenceItem = {
  id: string
  absence_type: number
  absence_type_name?: string
  start_date: string
  end_date: string
  absence_reason: string
  is_ended?: boolean
  created_at: string
}

type Props = {
  absenceTypes: AbsenceType[]
  onEditClick: (item: AbsenceItem) => void
  onRefreshTrigger: number
}

// 헬퍼 함수: Date 객체를 YYYY-MM-DD 문자열로 변환 (로컬 타임존 기준)
const formatDateStr = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 기본 시작일/종료일 계산 (오늘 기준 최근 7일)
const getInitialDates = () => {
  const today = new Date()
  const sixDaysAgo = new Date()
  sixDaysAgo.setDate(today.getDate() - 6) // 오늘 포함 총 7일

  return {
    defaultStart: formatDateStr(sixDaysAgo),
    defaultEnd: formatDateStr(today),
  }
}

export default function AbsenceReasonList({ absenceTypes, onEditClick, onRefreshTrigger }: Props) {
  const [items, setItems] = useState<AbsenceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 1. 조회 필터 상태 초기값 설정 (최근 1주일 & 진행 중 기본값)
  const { defaultStart, defaultEnd } = getInitialDates()
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended'>('all')

  const fetchList = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      // 날짜 유효성 검직 (시작일이 종료일보다 뒤인 경우)
      if (startDate && endDate && startDate > endDate) {
        setError('조회 시작일은 종료일보다 이전이어야 합니다.')
        setLoading(false)
        return
      }

      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (statusFilter !== 'all') params.append('statusFilter', statusFilter)

      const res = await fetch(`/api/attendance/absence-reason?${params.toString()}`)
      if (!res.ok) throw new Error('목록을 불러오지 못했습니다.')
      const data = await res.json()
      setItems(data.items || [])
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, statusFilter])

  useEffect(() => {
    fetchList()
  }, [fetchList, onRefreshTrigger])

  const handleDelete = async (id: string) => {
    if (!confirm('정말로 이 결석 사유를 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/attendance/absence-reason?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        alert('삭제되었습니다.')
        fetchList()
      } else {
        const data = await res.json()
        alert(data.error || '삭제 처리 실패')
      }
    } catch {
      alert('서버 통신 오류')
    }
  }

  // 필터 초기화 함수 (필요 시 활용)
  const handleResetFilter = () => {
    const { defaultStart, defaultEnd } = getInitialDates()
    setStartDate(defaultStart)
    setEndDate(defaultEnd)
    setStatusFilter('active')
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '12px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>📋 내 결석 사유 신청 내역</h3>
        <button
          type="button"
          onClick={handleResetFilter}
          style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer', color: '#475569' }}
        >
          초기화 (최근 7일)
        </button>
      </div>

      {/* 날짜 및 상태 필터 컨트롤 바 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
        <div style={{ flex: 1, minWidth: '130px' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 'bold' }}>조회 시작일</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: '130px' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 'bold' }}>조회 종료일</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          />
        </div>
        <div style={{ minWidth: '100px' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 'bold' }}>상태 필터</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          >
            <option value="all">전체</option>
            <option value="active">진행 중</option>
            <option value="ended">종료됨</option>
            
          </select>
        </div>
      </div>

      {error && <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>내역을 불러오는 중입니다...</div>
      ) : items.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>조회 조건에 해당하는 결석 사유가 없습니다.</div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {items.map((item) => {
            const typeLabel = item.absence_type_name || absenceTypes.find((t) => Number(t.id) === Number(item.absence_type))?.text || '미지정'
            return (
              <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '14px' }}>[{typeLabel}]</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {item.start_date} ~ {item.end_date}
                  </span>
                </div>
                <p style={{ margin: '4px 0', fontSize: '14px', whiteSpace: 'pre-wrap', color: '#333' }}>{item.absence_reason}</p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => onEditClick(item)}
                    style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: 'none', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer' }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
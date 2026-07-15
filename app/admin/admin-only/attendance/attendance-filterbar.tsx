// app/admin/admin-only/attendance/attendance-filterbar.tsx
'use client'

import { useEffect, useState } from 'react'
import AffiliationSelect from '@/components/common/affiliation-select'

interface EventSelectOption {
  id: string
  name: string
  start_time: string
  affiliations_id?: string | number | null
}

interface AttendanceFilterBarProps {
  currentDate: string
  onDateChange: (date: string) => void
  selectedAffiliationId: string
  onAffiliationChange: (id: string) => void
  selectedEventId: string                      // 💡 [추가] 선택된 행사 ID
  onEventChange: (id: string) => void          // 💡 [추가] 행사 변경 핸들러
  totalCount: number
}

export default function AttendanceFilterBar({
  currentDate,
  onDateChange,
  selectedAffiliationId,
  onAffiliationChange,
  selectedEventId,
  onEventChange,
  totalCount
}: AttendanceFilterBarProps) {
  const [events, setEvents] = useState<EventSelectOption[]>([])
  const [eventLoading, setEventLoading] = useState<boolean>(false)

  // 1. 소속 필터가 변경될 때 연계된 행사 목록을 새로 로드하거나 소속에 따라 필터링합니다.
  useEffect(() => {
    async function loadEvents() {
      setEventLoading(true)
      try {
        // 기존 행사 목록 조회 API 활용
        const params = new URLSearchParams()
        if (selectedAffiliationId) {
          params.set('affiliation_id', selectedAffiliationId)
        }
        const res = await fetch(`/api/events/list?${params.toString()}`)
        const data = await res.json()
        
        if (res.ok && data.items) {
          setEvents(data.items)
        } else {
          const items = Array.isArray(data) ? data : (data.data || [])
          setEvents(items)
        }
      } catch (err) {
        console.error('행사 목록 조회 실패:', err)
      } finally {
        setEventLoading(false)
      }
    }

    void loadEvents()
    // 소속이 바뀔 때 선택된 행사 필터도 초기화
    onEventChange('') 
  }, [selectedAffiliationId, onEventChange])

  return (
    <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* 날짜 필터 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>📅 조회 일자 선택 :</span>
          <input
            type="date"
            value={currentDate}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '14px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          {/* 소속 필터 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="affiliation-filter" style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
              🔍 소속 필터 :
            </label>
            <AffiliationSelect 
              value={selectedAffiliationId} 
              onChange={onAffiliationChange} 
            />
          </div>

          {/* 💡 [추가] 행사 필터 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="event-filter" style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
              🎯 행사 필터 :
            </label>
            <select
              id="event-filter"
              value={selectedEventId}
              onChange={(e) => onEventChange(e.target.value)}
              disabled={eventLoading}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '14px', minWidth: '180px', cursor: 'pointer' }}
            >
              <option value="">전체 행사 보기</option>
              {events.map((evt) => {
                const localDate = evt.start_time ? new Date(evt.start_time).toLocaleDateString() : ''
                return (
                  <option key={evt.id} value={evt.id}>
                    [{localDate}] {evt.name}
                  </option>
                )
              })}
            </select>
          </div>

          {(selectedAffiliationId || selectedEventId) && (
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              검색 결과: <strong>{totalCount}</strong>명
            </span>
          )}
        </div>

      </div>
    </div>
  )
}
//app\admin\admin-only\export\components\event-multi-select.tsx
'use client'

import React from 'react'
import { EventItem } from '../hooks/use-attendance-export'

type EventMultiSelectProps = {
  events: EventItem[]
  eventIds: string[]
  eventsLoading: boolean
  onSelectChange: (selectedIds: string[]) => void
}

export default function EventMultiSelect({
  events,
  eventIds,
  eventsLoading,
  onSelectChange,
}: EventMultiSelectProps) {
  
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selectedOptions = Array.from(e.target.selectedOptions).map(
      (option) => option.value
    )
    onSelectChange(selectedOptions)
  }

  return (
    <div>
      <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
        행사 선택 (다중 선택: Ctrl 또는 Cmd 키를 누른 채 클릭)
        {eventsLoading && (
          <span style={{ color: '#2563eb', marginLeft: '8px', fontSize: '13px' }}>
            🔄 업데이트 중... 
          </span>
        )}
      </label>
      <select
        multiple
        value={eventIds}
        onChange={handleChange}
        disabled={eventsLoading} // 로딩 시 조작 방지 논리 유지 [cite: 20]
        style={{
          width: '100%',
          padding: '10px',
          boxSizing: 'border-box',
         height: '160px', 
        }}
      >
        {events.length === 0 ? (
          <option value="" disabled>행사 없음</option>
        ) : (
          events.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option> 
          ))
        )}
      </select>
    </div>
  )
}
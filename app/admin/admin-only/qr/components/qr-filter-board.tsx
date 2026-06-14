'use client'

import React from 'react'
import AffiliationSelect from '@/components/common/affiliation-select'
import { styles } from '../styles'

interface QrFilterBoardProps {
  selectedAffiliationId: string
  onChange: (id: string) => void
  filteredCount: number
}

export default function QrFilterBoard({ selectedAffiliationId, onChange, filteredCount }: QrFilterBoardProps) {
  return (
    <div style={{ ...styles.panelStyle, display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 24px' }}>
      <label htmlFor="affiliation-filter" style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
        🔍 소속 필터 조회 :
      </label>
      <AffiliationSelect 
        value={selectedAffiliationId} 
        onChange={onChange} 
      />
      {selectedAffiliationId && (
        <span style={{ fontSize: '13px', color: '#64748b' }}>
          총 <strong>{filteredCount}</strong>개의 예약 건이 검색되었습니다.
        </span>
      )}
    </div>
  )
}
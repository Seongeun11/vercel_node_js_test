//components\common\affiliation-select.tsx
'use client'

import { useEffect, useState } from 'react'

// 컴포넌트가 외부(부모)와 소통할 인터페이스 정의
interface AffiliationItem {
  id: number
  name: string
}

interface AffiliationSelectProps {
  value: string                     // 부모의 selectedAffiliationId 상태 바인딩
  onChange: (value: string) => void // 상태 변경 핸들러 바인딩
  showAllOption?: boolean           // '전체 보기' 옵션 노출 여부 (선택)
  allOptionLabel?: string           // '전체 보기' 텍스트 커스텀 (선택)
}

export default function AffiliationSelect({
  value,
  onChange,
  showAllOption = true,
  allOptionLabel = '전체 보기 (전체 노출)'
}: AffiliationSelectProps) {
  const [affiliations, setAffiliations] = useState<AffiliationItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')

  // 소속 데이터 API 로딩 (기존 로직 완벽 이식)
  useEffect(() => {
    async function loadAffiliations() {
      try {
        setLoading(true)
        const res = await fetch('/api/affiliations', { method: 'GET', cache: 'no-store' })
        const result = await res.json()
        
        if (res.ok && result.success && result.data) {
          setAffiliations(result.data)
        } else {
          throw new Error(result.error || '소속 목록 로드 실패')
        }
      } catch (err) {
        console.error('AffiliationSelect 로딩 에러:', err)
        setError('소속 로드 실패')
      } finally {
        setLoading(false)
      }
    }

    void loadAffiliations()
  }, [])

  if (error) return <span style={{ color: '#ef4444', fontSize: '14px' }}>⚠️ {error}</span>
  if (loading) return <span style={{ color: '#94a3b8', fontSize: '14px' }}>소속 불러오는 중...</span>

  return (
    <select
      id="affiliation-filter"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid #cbd5e1',
        fontSize: '14px',
        minWidth: '180px',
        outline: 'none',
        background: '#ffffff',
        cursor: 'pointer'
      }}
    >
      {showAllOption && <option value="">{allOptionLabel}</option>}
      {affiliations.map((aff) => (
        <option key={aff.id} value={String(aff.id)}>
          {aff.name}
        </option>
      ))}
    </select>
  )
}
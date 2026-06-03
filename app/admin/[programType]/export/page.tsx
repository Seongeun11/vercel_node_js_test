'use client'

import { useEffect, useState } from 'react'
import AdminHeader from '@/components/admin/AdminHeader'

type EventItem = {
  id: string
  name: string
  start_time: string
}

type eventListResponse = {
  items?: EventItem[]
  error?: string
}

function getTodayDate(): string {
  const now = new Date()

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getFirstDayOfMonth(date?: string): string {
  const base = date ? new Date(date) : new Date()

  const year = base.getFullYear()
  const month = String(base.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}-01`
}

export default function AttendanceExportPage() {
  const today = getTodayDate()

  const [events, setEvents] = useState<EventItem[]>([])
  const [eventIds, setEventIds] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth(today))
  const [dateTo, setDateTo] = useState(today)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    async function fetchevent() {
      try {
        setLoading(true)
        setErrorMessage('')

        const response = await fetch('/api/event/list', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        })

        const text = await response.text()
        const result: eventListResponse = text ? JSON.parse(text) : {}

        if (!response.ok) {
          setErrorMessage(result.error || '행사 목록을 불러오지 못했습니다.')
          return
        }

        const nextevent = result.items ?? []
        setEvents(nextevent)
        setEventIds([]) 
      } catch (error) {
        console.error('[attendance/export] event fetch error:', error)
        setErrorMessage('행사 목록 조회 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    void fetchevent()
  }, [])

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selectedOptions = Array.from(e.target.selectedOptions).map(
      (option) => option.value
    )
    setEventIds(selectedOptions)
  }

  async function handleDownloadExcel() {
    setErrorMessage('')

    if (eventIds.length === 0) {
      setErrorMessage('행사를 최소 하나 이상 선택해주세요.')
      return
    }

    if (!dateFrom || !dateTo) {
      setErrorMessage('조회 시작일과 종료일을 선택해주세요.')
      return
    }

    if (dateFrom > dateTo) {
      setErrorMessage('조회 시작일은 종료일보다 늦을 수 없습니다.')
      return
    }

    try {
      setDownloading(true)

      const params = new URLSearchParams()
      
      // ✨ [논리오류 해결] 백엔드 multi-query 파싱 규격에 맞게 event_id 키를 여러 번 append 합니다.
      // 결과 형식: ?event_id=UUID_1&event_id=UUID_2...
      eventIds.forEach((id) => {
        params.append('event_id', id)
      })
      
      params.set('date_from', dateFrom)
      params.set('date_to', dateTo)

      const response = await fetch(`/api/admin/attendance/export?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const errResult = await response.json()
          throw new Error(errResult.error || '엑셀 다운로드에 실패했습니다.')
        }
        throw new Error('엑셀 다운로드 중 서버 오류가 발생했습니다.')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      const selectedNames = events
        .filter((ev) => eventIds.includes(ev.id))
        .map((ev) => ev.name)
      const fileName = selectedNames.length > 1 
        ? `${selectedNames[0]}_외_${selectedNames.length - 1}건_통합_출석현황.xlsx`
        : `${selectedNames[0] || '행사'}_출석현황.xlsx`
        
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      
      window.URL.revokeObjectURL(url)
      a.remove()
    } catch (error: any) {
      console.error('[attendance/export] download error:', error)
      setErrorMessage(error.message || '엑셀 다운로드 중 오류가 발생했습니다.')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '24px' }}>로딩중...</div>
  }

  return (
    <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
      <AdminHeader
        title="출석현황 엑셀 다운로드"
        description="복수의 행사와 날짜 범위를 선택해 통합 출석현황을 엑셀 파일로 다운로드합니다."
      />

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '12px',
          background: '#fff',
          padding: '20px',
        }}
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
              행사 선택 (다중 선택: Ctrl 또는 Cmd 키를 누른 채 클릭)
            </label>
            <select
              multiple
              value={eventIds}
              onChange={handleSelectChange}
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

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
              시작일
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
              종료일
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button 
            type="button" 
            onClick={handleDownloadExcel}
            disabled={downloading}
            style={{
              padding: '12px',
              background: downloading ? '#94a3b8' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: downloading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {downloading ? '엑셀 파일 생성 중...' : '통합 엑셀 다운로드'}
          </button>
        </div>

        {errorMessage && (
          <p style={{ color: '#dc2626', marginTop: '16px', fontWeight: '500' }}>{errorMessage}</p>
        )}

        <div
          style={{
            marginTop: '20px',
            padding: '14px',
            borderRadius: '8px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            color: '#334155',
            fontSize: '14px',
            lineHeight: '1.6'
          }}
        >
          <strong style={{ color: '#0f172a' }}>📊 엑셀 출력 가이드 (Multi-Event)</strong>
          <br />
          선택한 이벤트들이 단일 시트 내에 우측 열(Column)로 확장되어 병합 출력됩니다.
          <div style={{ 
            marginTop: '8px', 
            padding: '8px', 
            background: '#fff', 
            borderRadius: '4px', 
            fontFamily: 'monospace',
            border: '1px dashed #cbd5e1'
          }}>
            [출석번호] | [이름] | [날짜별 출석 상태 (이벤트 A)] | [날짜별 출석 상태 (이벤트 B)] ...
          </div>
        </div>
      </div>
    </div>
  )
}
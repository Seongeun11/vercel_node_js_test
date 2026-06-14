//app\admin\admin-only\export\hooks\use-attendance-export.ts
'use client'

import { useState, useEffect } from 'react'

export type EventItem = {
  id: string
  name: string
  start_time: string
}

type EventListResponse = {
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

export function useAttendanceExport() {
  const today = getTodayDate()

  const [events, setEvents] = useState<EventItem[]>([])
  const [eventIds, setEventIds] = useState<string[]>([])

  
  // ✨ [논리 수정] 초기 소속 필터 상태값을 '전체'('')가 아닌 '아카데미'('1')로 강제 설정합니다.
  const [selectedAffiliationId, setSelectedAffiliationId] = useState<string>('1')
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth(today))
  const [dateTo, setDateTo] = useState(today)

  const [pageLoading, setPageLoading] = useState(true)       // 최초 진입 로딩
  const [eventsLoading, setEventsLoading] = useState(false)   // 소속 변경 시 로딩 
  const [errorMessage, setErrorMessage] = useState('')
  const [downloading, setDownloading] = useState(false)

  // 소속 변경 핸들러 (1 로시작) 
  function handleAffiliationChange(affiliationId: string) {
    setSelectedAffiliationId(affiliationId)
    setEventIds([])
  }

  // 행사 선택 변경 핸들러
  function handleSelectChange(selectedIds: string[]) {
    setEventIds(selectedIds)
  }

  // 백엔드 API 연동 Effect 
  useEffect(() => {
    async function fetchEvent() {
      try {
        if (!pageLoading) setEventsLoading(true) // 소속 변경 시 리페치 로딩 활성화 
        setErrorMessage('')

        const params = new URLSearchParams()
        if (selectedAffiliationId) {
          params.set('affiliation_id', selectedAffiliationId)
        }

        const response = await fetch(`/api/events/list?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        })

        const text = await response.text()
        const result: EventListResponse = text ? JSON.parse(text) : {} 
        if (!response.ok) {
          setErrorMessage(result.error || '행사 목록을 불러오지 못했습니다.')
          return
        }

        setEvents(result.items ?? []) 
      } catch (error) {
        console.error('[attendance/export] events fetch error:', error)
        setErrorMessage('행사 목록 조회 중 오류가 발생했습니다.')
      } finally {
        setPageLoading(false)
        setEventsLoading(false)
      }
    }

    void fetchEvent()
  }, [selectedAffiliationId])

  // 엑셀 다운로드 핵심 로직
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
  
  // 1. 선택된 다중 행사 ID 배열 주입 [cite: 143]
  eventIds.forEach((id) => {
    params.append('event_id', id)
  })
  
  // 2. 날짜 범위 주입 [cite: 144]
  params.set('date_from', dateFrom)
  params.set('date_to', dateTo)

  // ✨ [논리 추가] 현재 컴포넌트 상태에 활성화된 소속 ID 필터를 함께 전송
    if (selectedAffiliationId) {
      params.set('affiliation_id', selectedAffiliationId)
    }

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
      
      // 동적 파일네이밍 논리 보존 
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

  return {
    events,
    eventIds,
    selectedAffiliationId,
    dateFrom,
    dateTo,
    pageLoading,
    eventsLoading,
    errorMessage,
    downloading,
    setDateFrom,
    setDateTo,
    handleAffiliationChange,
    handleSelectChange,
    handleDownloadExcel,
  }
}
'use client'

import { useCallback, useState } from 'react'
import { EventItem, AffiliationItem } from '../types'

export function useEvents() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [affiliations, setAffiliations] = useState<AffiliationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchEvents = useCallback(async (): Promise<EventItem[]> => {
    const res = await fetch('/api/events/list', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error ?? '행사 조회 실패')
    }
    return Array.isArray(data.items) ? (data.items as EventItem[]) : []
  }, [])

  // 데이터베이스 마스터 소속 정보 조회 및 폴백 제공
  const fetchAffiliations = useCallback(async (): Promise<AffiliationItem[]> => {
    try {
      const res = await fetch('/api/affiliations/list', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        if (data.items && Array.isArray(data.items)) {
          return data.items
        }
      }
    } catch (e) {
      console.error('소속 목록을 불러오지 못해 스키마 기반 기본값을 제공합니다.', e)
    }

    // API 에러 혹은 미구현 시 마스터 로컬 데이터 반환
    return [
      { id: 1, name: '아카데미' },
      { id: 2, name: '영성 40일' },
      { id: 3, name: '모심 40일' },
      { id: 4, name: '효진정' },
      { id: 5, name: '성화영성' },
      { id: 6, name: '3일 공명기도' },
    ]
  }, [])

  // [수정 완료]: 이벤트 목록과 소속 코드 목록을 동시에 받아 처리하도록 개선
  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      
      const [fetchedEvents, fetchedAffiliations] = await Promise.all([
        fetchEvents(),
        fetchAffiliations()
      ])

      setEvents(fetchedEvents)
      setAffiliations(fetchedAffiliations)
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로딩 중 오류 발생')
    } finally {
      setLoading(false)
    }
  }, [fetchEvents, fetchAffiliations])

  return {
    events,
    setEvents,
    affiliations,
    loading,
    error,
    setError,
    refresh,
  }
}
'use client'

import { useCallback, useState } from 'react'

import { EventItem } from '../types'

export function useevent() {
  const [event, setevent] =
    useState<EventItem[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const fetchevent =
    useCallback(async (): Promise<
      EventItem[]
    > => {
      const res = await fetch(
        '/api/event/list',
        {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        }
      )

      const data =
        await res.json()

      if (!res.ok) {
        throw new Error(
          data.error ??
            '행사 조회 실패'
        )
      }

      return Array.isArray(
        data.items
      )
        ? (data.items as EventItem[])
        : []
    }, [])

  const refresh =
    useCallback(async () => {
      try {
        setLoading(true)
        setError('')

        const items =
          await fetchevent()

        setevent(items)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : '행사 조회 중 오류 발생'
        )
      } finally {
        setLoading(false)
      }
    }, [fetchevent])

  return {
    event,
    setevent,
    loading,
    error,
    setError,
    refresh,
  }
}
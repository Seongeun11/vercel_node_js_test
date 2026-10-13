// app/admin/admin-only/points/hooks/use-sheet-sync.ts
'use client'

import { useState, useEffect } from 'react'

export function useSheetSync(onSuccess?: () => void) {
  const [sheetUrl, setSheetUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [savingUrl, setSavingUrl] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string[]>([])

  // 최초 로드 시 저장된 링크 가져오기
  useEffect(() => {
    async function fetchSavedUrl() {
      try {
        const res = await fetch('/api/admin/points/sheet-url', { method: 'GET' })
        const data = await res.json()
        if (data.success && data.sheetUrl) {
          setSheetUrl(data.sheetUrl)
        }
      } catch (err) {
        console.error('시트 URL 조회 실패:', err)
      }
    }
    fetchSavedUrl()
  }, [])

  const saveSheetUrl = async () => {
    if (!sheetUrl.trim()) {
      alert('구글 스프레드시트 링크를 입력해주세요.')
      return
    }

    setSavingUrl(true)
    try {
      const res = await fetch('/api/admin/points/sheet-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl: sheetUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '저장 실패')
      alert('구글 시트 링크가 Supabase에 안전하게 저장되었습니다.')
    } catch (err: any) {
      alert(err.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setSavingUrl(false)
    }
  }

  const syncSheet = async (targetUrl?: string) => {
    const urlToSync = targetUrl || sheetUrl
    if (!urlToSync.trim()) {
      alert('구글 스프레드시트 링크를 입력해주세요.')
      return
    }

    setLoading(true)
    setResultMessage(null)
    setErrorDetails([])

    try {
      const res = await fetch('/api/admin/points/sync-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sheetUrl: urlToSync.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '동기화 중 오류가 발생했습니다.')
        return
      }

      setResultMessage(data.message)
      if (data.details?.errors) {
        setErrorDetails(data.details.errors)
      }

      if (onSuccess) onSuccess()
    } catch (err) {
      console.error(err)
      alert('네트워크 통신 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return {
    sheetUrl,
    setSheetUrl,
    loading,
    savingUrl,
    resultMessage,
    errorDetails,
    syncSheet,
    saveSheetUrl,
  }
}
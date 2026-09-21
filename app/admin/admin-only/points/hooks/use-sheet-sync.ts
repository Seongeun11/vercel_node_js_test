'use client'

import { useState } from 'react'

export function useSheetSync(onSuccess?: () => void) {
  const [sheetUrl, setSheetUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string[]>([])

  const syncSheet = async () => {
    if (!sheetUrl.trim()) {
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
        body: JSON.stringify({ sheetUrl: sheetUrl.trim() }),
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
    resultMessage,
    errorDetails,
    syncSheet,
  }
}
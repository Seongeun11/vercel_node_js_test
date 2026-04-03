'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'
import { fetchSessionUser, hasRole } from '@/lib/auth'

type StoredUser = {
  id: string
  full_name: string
  student_id: string
  role: 'admin' | 'captain' | 'trainee'
}

export default function AdminQrViewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qrUrl = searchParams.get('url') ?? ''

  const [loading, setLoading] = useState(true)
  const [qrImageUrl, setQrImageUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const init = async () => {
      try {
        const savedUser = (await fetchSessionUser()) as StoredUser | null

        if (!savedUser) {
          router.replace('/login')
          return
        }

        if (!hasRole(savedUser, ['admin'])) {
          alert('관리자만 접근할 수 있습니다.')
          router.replace('/')
          return
        }

        if (!qrUrl) {
          setErrorMessage('QR 링크가 없습니다.')
          return
        }

        const dataUrl = await QRCode.toDataURL(qrUrl, {
          width: 420,
          margin: 2,
        })

        setQrImageUrl(dataUrl)
      } catch (error) {
        console.error(error)
        setErrorMessage('QR 페이지 로딩 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    void init()
  }, [qrUrl, router])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl)
      alert('링크가 복사되었습니다.')
    } catch (error) {
      console.error(error)
      alert('링크 복사에 실패했습니다.')
    }
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>로딩중...</div>
  }

  return (
    <div style={{ padding: '20px', maxWidth: '720px', margin: '0 auto' }}>
      <h2>QR 크게 보기</h2>

      {errorMessage ? (
        <p style={{ color: 'crimson' }}>{errorMessage}</p>
      ) : (
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '12px',
            padding: '24px',
            background: '#fff',
            textAlign: 'center',
          }}
        >
          {qrImageUrl && (
            <img
              src={qrImageUrl}
              alt="출석 QR 코드"
              style={{
                width: '100%',
                maxWidth: '420px',
                height: 'auto',
                display: 'block',
                margin: '0 auto 20px',
                background: '#fff',
              }}
            />
          )}

          <p
            style={{
              fontSize: '14px',
              color: '#555',
              wordBreak: 'break-all',
              marginBottom: '16px',
            }}
          >
            {qrUrl}
          </p>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleCopy}>링크 복사</button>
            
          </div>
        </div>
      )}
    </div>
  )
}
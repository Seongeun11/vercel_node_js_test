'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'



type Props = {
  qrUrl: string
  qrId: string
  fullscreen: boolean
}

export default function AdminQrViewClient({
  qrUrl,
  qrId,
  fullscreen,
}: Props) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [loading, setLoading] = useState(true)
  const [qrImageUrl, setQrImageUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenMessage, setFullscreenMessage] = useState('')

  const requestFullscreen = useCallback(async () => {
    try {
      const element = containerRef.current ?? document.documentElement

      if (document.fullscreenElement) {
        setIsFullscreen(true)
        return true
      }

      if (element.requestFullscreen) {
        await element.requestFullscreen()
        setIsFullscreen(true)
        setFullscreenMessage('')
        return true
      }

      setFullscreenMessage('이 브라우저는 전체화면을 지원하지 않습니다.')
      return false
    } catch (error) {
      console.error(error)
      setIsFullscreen(false)
      setFullscreenMessage('자동 전체화면이 차단되었습니다. 아래 버튼을 눌러주세요.')
      return false
    }
  }, [])

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      }
      setIsFullscreen(false)
    } catch (error) {
      console.error(error)
    }
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl)
      alert('링크가 복사되었습니다.')
    } catch (error) {
      console.error(error)
      alert('링크 복사에 실패했습니다.')
    }
  }

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        

        if (!qrUrl) {
          setErrorMessage('QR 링크가 없습니다.')
          return
        }

        const dataUrl = await QRCode.toDataURL(qrUrl, {
          width: 720,
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

  useEffect(() => {
    if (!loading && !errorMessage && fullscreen) {
      void requestFullscreen()
    }
  }, [loading, errorMessage, fullscreen, requestFullscreen])

  if (loading) {
    return <div style={{ padding: '20px' }}>로딩중...</div>
  }

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '100vh',
        background: '#ffffff',
        padding: isFullscreen ? '12px' : '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: isFullscreen ? '100vw' : '900px',
          textAlign: 'center',
        }}
      >
        {errorMessage ? (
          <p style={{ color: 'crimson' }}>{errorMessage}</p>
        ) : (
          <>
            {!isFullscreen && (
              <>
                <h2 style={{ marginTop: 0 }}>QR 크게 보기</h2>

                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    marginBottom: '16px',
                  }}
                >
                  <button type="button" onClick={() => void requestFullscreen()}>
                    전체화면
                  </button>
                  <button type="button" onClick={handleCopy}>
                    링크 복사
                  </button>
                  <button type="button" onClick={() => window.close()}>
                    창 닫기
                  </button>
                  <button type="button" onClick={() => router.push('/admin/events')}>
                    이벤트 관리로
                  </button>
                </div>

                {fullscreenMessage && (
                  <p style={{ color: '#b45309', marginBottom: '16px' }}>
                    {fullscreenMessage}
                  </p>
                )}
              </>
            )}

            <div
              style={{
                background: '#fff',
                border: isFullscreen ? 'none' : '1px solid #ddd',
                borderRadius: isFullscreen ? '0' : '16px',
                padding: isFullscreen ? '0' : '24px',
              }}
            >
              {qrImageUrl && (
                <img
                  src={qrImageUrl}
                  alt={`출석 QR 코드 ${qrId}`}
                  style={{
                    width: '100%',
                    maxWidth: isFullscreen ? 'min(90vh, 90vw)' : '720px',
                    height: 'auto',
                    display: 'block',
                    margin: '0 auto',
                    objectFit: 'contain',
                  }}
                />
              )}

              {!isFullscreen && qrUrl && (
                <p
                  style={{
                    marginTop: '16px',
                    fontSize: '14px',
                    color: '#555',
                    wordBreak: 'break-all',
                  }}
                >
                  {qrUrl}
                </p>
              )}
            </div>

            {isFullscreen && (
              <div
                style={{
                  position: 'fixed',
                  right: '16px',
                  bottom: '16px',
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <button type="button" onClick={() => void exitFullscreen()}>
                  전체화면 종료
                </button>
                <button type="button" onClick={() => window.close()}>
                  창 닫기
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
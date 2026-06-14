'use client'

import React from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { styles } from '../styles'

interface QrZoomModalProps {
  isOpen: boolean
  eventName: string
  qrUrl: string
  onClose: () => void
}

export default function QrZoomModal({ isOpen, eventName, qrUrl, onClose }: QrZoomModalProps) {
  if (!isOpen) return null

  const handleDownloadQrImage = () => {
    const canvas = document.getElementById('zoom-qr-canvas') as HTMLCanvasElement | null
    if (!canvas) {
      alert('QR 코드 이미지를 준비하는 중 오류가 발생했습니다.')
      return
    }

    try {
      const qrDataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = qrDataUrl
      link.download = `${eventName.replace(/\s+/g, '_')}_출석QR.png`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('QR 이미지 저장 에러:', err)
      alert('브라우저 보안 제약 또는 장치 문제로 파일 저장에 실패했습니다.')
    }
  }

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{eventName}</h4>
        <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>현장 스캐너 인식용 QR 코드입니다.</p>
        
        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', display: 'inline-block', boxShadow: '0 0 0 1px #e2e8f0' }}>
          <QRCodeCanvas 
            id="zoom-qr-canvas"
            value={qrUrl} 
            size={256} 
            level="H" 
            includeMargin={true}
          />
        </div>
        
        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            onClick={handleDownloadQrImage}
            style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}
          >
            QR 이미지(.PNG) 저장하기
          </button>
          <button 
            onClick={onClose}
            style={{ width: '100%', padding: '10px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '14px' }}
          >
            화면 닫기
          </button>
        </div>
      </div>
    </div>
  )
}
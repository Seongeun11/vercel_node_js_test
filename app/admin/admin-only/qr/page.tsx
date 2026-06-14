'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { EventItem, QrTokenItem } from './types'
import { styles } from './styles'
import QrFilterBoard from './components/qr-filter-board'
import QrStatusTable from './components/qr-status-table'
import QrZoomModal from './components/qr-zoom-modal'

export default function CentralizedEventsQrClient() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [activeQrTokens, setActiveQrTokens] = useState<Record<string, QrTokenItem>>({})
  
  const [loading, setLoading] = useState(true)
  const [editingId] = useState<string | null>(null) // 기존 기능 유지용 상태
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedQr, setSelectedQr] = useState<{ eventName: string; qrUrl: string } | null>(null)
  const [selectedAffiliationId, setSelectedAffiliationId] = useState<string>('')
  
  const refreshAllData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const eventRes = await fetch('/api/events/list', { method: 'GET', cache: 'no-store' })
      const eventData = await eventRes.json()
      if (eventRes.ok && eventData.items) {
        setEvents(eventData.items)
      }

      const qrRes = await fetch('/api/qr/list', { method: 'GET', cache: 'no-store' })
      const qrData = await qrRes.json()
      
      if (qrRes.ok && qrData.qr_tokens) {
        const qrMap: Record<string, QrTokenItem> = {}
        qrData.qr_tokens.forEach((t: QrTokenItem) => { 
          qrMap[t.event_id] = t 
        })
        setActiveQrTokens(qrMap)
      }
    } catch (err) {
      setError('서버 저장소 동기화 중 에러가 발생했습니다. 아래 대시보드는 로컬 상태로 시뮬레이션 모드를 유지합니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshAllData()
  }, [refreshAllData])

  const filteredEvents = useMemo(() => {
    if (!selectedAffiliationId) return events
    return events.filter(event => String(event.affiliations_id) === selectedAffiliationId)
  }, [events, selectedAffiliationId])

  const handleStandaloneQrPreGenerate = async (eventId: string, startTimeIso: string) => {
    try {
      setError('')
      setSuccess('')
      
      const requestPayload = {
        event_id: eventId,
        occurrence_id: null,
        expire_unit: 'unlimited',
        expire_value: null
      }

      const res = await fetch('/api/qr/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      })

      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'QR 예약 발행 트랜잭션이 거부되었습니다.')
      
      setSuccess(data.message || '예약 일정에 대응하는 배포/인쇄용 QR 생성에 성공했습니다.')
      await refreshAllData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR 발급 과정 중 알 수 없는 오류가 발생했습니다.')
    }
  }

  const handleDeleteQR = useCallback(async (qrId: string, eventId: string) => {
    const isConfirmed = window.confirm(
      '이 QR 코드를 정말로 삭제하시겠습니까?\n삭제 후에는 수련생들이 이 QR로 출석할 수 없습니다.'
    )
    if (!isConfirmed) return

    try {
      setError('')
      setSuccess('')

      const res = await fetch('/api/qr/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: qrId }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'QR 코드를 삭제하는 도중 오류가 발생했습니다.')

      alert(result.message || 'QR 코드가 성공적으로 삭제되었습니다.')

      setActiveQrTokens((prevMap) => {
        const nextMap = { ...prevMap }
        delete nextMap[eventId]
        return nextMap
      })
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[HANDLE_DELETE_QR_ERROR]', error)
      }
      alert(`삭제 실패: ${error.message}`)
    }
  }, [])

  const openQrZoomModal = (eventName: string, qrUrl: string | null) => {
    if (!qrUrl) {
      alert('스캔 가능한 유효 QR 링크 주소가 존재하지 않습니다.')
      return
    }
    setSelectedQr({ eventName, qrUrl })
    setIsModalOpen(true)
  }

  return (
    <div style={styles.containerStyle}>
      <header style={{ marginBottom: '32px', borderBottom: '2px solid #f1f5f9', paddingBottom: '16px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: 0 }}>예약형 QR 관리 시스템</h2>
        <p style={{ color: '#64748b', fontSize: '15px', marginTop: '6px' }}>
          행사와 연결된 인쇄·배포용 QR 코드를 사전에 안전하게 생성하여 연동하는 QR 예약 페이지입니다.
        </p>
      </header>

      {error && <div style={{ ...styles.panelStyle, background: '#fef2f2', color: '#b91c1c', borderColor: '#fca5a5', fontWeight: 500 }}>⚠️ {error}</div>}
      {success && <div style={{ ...styles.panelStyle, background: '#f0fdf4', color: '#16a34a', borderColor: '#86efac', fontWeight: 500 }}>✅ {success}</div>}

      <QrFilterBoard 
        selectedAffiliationId={selectedAffiliationId}
        onChange={setSelectedAffiliationId}
        filteredCount={filteredEvents.length}
      />

      <h3 style={{ fontSize: '20px', color: '#1e293b', marginBottom: '12px' }}>QR 예약 및 발급 현황 내역</h3>
      
      {loading ? (
        <div style={styles.emptyBoxStyle}>서버 데이터베이스 동기화 중...</div>
      ) : filteredEvents.length === 0 ? (
        <div style={styles.emptyBoxStyle}>조건에 부합하는 예약 QR 코드가 존재하지 않습니다.</div>
      ) : (
        <QrStatusTable 
          filteredEvents={filteredEvents}
          activeQrTokens={activeQrTokens}
          editingId={editingId}
          onPreGenerate={handleStandaloneQrPreGenerate}
          onDeleteQr={handleDeleteQR}
          onOpenZoom={openQrZoomModal}
        />
      )}

      <QrZoomModal 
        isOpen={isModalOpen}
        eventName={selectedQr?.eventName || ''}
        qrUrl={selectedQr?.qrUrl || ''}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}
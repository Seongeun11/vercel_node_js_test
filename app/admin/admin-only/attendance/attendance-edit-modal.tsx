'use client'

import { useState, useEffect } from 'react'
import { AttendanceManageItem, AttendanceStatus } from './types/attendance'

interface EventSelectOption {
  id: string
  name: string
  start_time: string
}

interface AttendanceEditModalProps {
  isOpen: boolean
  item: AttendanceManageItem | null
  onClose: () => void
  onSave: (
    id: string,
    status: AttendanceStatus,
    checkTime: string,
    reason: string,
    eventId?: string
  ) => Promise<void>
}

export default function AttendanceEditModal({ isOpen, item, onClose, onSave }: AttendanceEditModalProps) {
  const [status, setStatus] = useState<AttendanceStatus>('present')
  const [checkTime, setCheckTime] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [events, setEvents] = useState<EventSelectOption[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [eventLoading, setEventLoading] = useState<boolean>(false)

  // 모달 오픈 시 행사 리스트 로드
  useEffect(() => {
    if (isOpen) {
      loadEventList()
    }
  }, [isOpen])

  // 모달 데이터 초기화
  useEffect(() => {
    if (item && isOpen) {
      setStatus(item.status)
      setSelectedEventId(item.event_id || item.event?.id || '')
      setReason('')
      
      if (item.check_time) {
        const d = new Date(item.check_time)
        const offset = d.getTimezoneOffset() * 60000
        const localIso = new Date(d.getTime() - offset).toISOString().slice(0, 16)
        setCheckTime(localIso)
      } else {
        setCheckTime(new Date().toISOString().slice(0, 16))
      }
    }
  }, [item, isOpen])

  const loadEventList = async () => {
    setEventLoading(true)
    try {
      const res = await fetch('/api/events/list')
      const data = await res.json()
      if (res.ok && data.items) {
        setEvents(data.items)
      } else {
        const items = Array.isArray(data) ? data : (data.data || [])
        setEvents(items)
      }
    } catch (err) {
      console.error('행사 목록을 가져오지 못했습니다.', err)
    } finally {
      setEventLoading(false)
    }
  }

  if (!isOpen || !item) return null

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert('출석 변경 사유를 입력해야 처리가 가능합니다.')
      return
    }

    setLoading(true)
    try {
      await onSave(item.id, status, checkTime, reason, selectedEventId)
      onClose()
    } catch (err: any) {
      alert(err.message || '인증 정보 에러 혹은 서버 통신 예외 발생')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>출석 원격 수정 및 사유 기입</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
        </div>

        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div>대상자 : <strong>{item.user?.full_name} ({item.user?.student_id})</strong></div>
          <div>현재 행사 : <span>{item.event?.name}</span></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 행사 변경 드롭다운 추가 */}
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>대상 행사 변경</label>
            <select 
              value={selectedEventId} 
              onChange={(e) => setSelectedEventId(e.target.value)} 
              disabled={eventLoading}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
            >
              {eventLoading ? (
                <option>행사 목록 조회 중...</option>
              ) : (
                events.map((evt) => {
                  const localDate = evt.start_time ? new Date(evt.start_time).toLocaleDateString() : ''
                  return (
                    <option key={evt.id} value={evt.id}>
                      [{localDate}] {evt.name}
                    </option>
                  )
                })
              )}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>출석 상태 조정</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <option value="present">출석 (Present)</option>
              <option value="late">지각 (Late)</option>
              <option value="absent">결석 (Absent)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>인식 처리 시각</label>
            <input type="datetime-local" value={checkTime} onChange={(e) => setCheckTime(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 600 }}>출석 수정 사유</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="예: 출석 대상 행사 잘못 선택 보정" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>취소</button>
          <button onClick={handleSubmit} disabled={loading} style={{ flex: 1, padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
            {loading ? '저장 중...' : '변경사항 적용'}
          </button>
        </div>

      </div>
    </div>
  )
}
// app/admin/admin-only/attendance/attendance-add-form.tsx
'use client'

import { useState, useEffect } from 'react'
import { AttendanceStatus, AttendanceMethod } from './types/attendance'

interface EventSelectOption {
  id: string
  name: string
  start_time: string
}

interface AttendanceAddFormProps {
  // 💡 등록 성공 시 부모 컴포넌트에 추가된 출석 날짜를 알려주어 부분 리프레시를 유도합니다.
  onSuccess: (addedDate: string) => void
}

export default function AttendanceAddForm({ onSuccess }: AttendanceAddFormProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [userKeyword, setUserKeyword] = useState<string>('') 
  
  // 행사 리스트 상태 및 선택된 행사 고유 ID 상태 추가
  const [events, setEvents] = useState<EventSelectOption[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  
  const [status, setStatus] = useState<AttendanceStatus>('present')
  const [method, setMethod] = useState<AttendanceMethod>('manual')
  const [checkTime, setCheckTime] = useState<string>(() => {
    const d = new Date()
    const offset = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - offset).toISOString().slice(0, 16)
  })
  const [reason, setReason] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [eventLoading, setEventLoading] = useState<boolean>(false)

  // 폼이 열릴 때 시스템 전체 행사 리스트를 비동기로 조회
  useEffect(() => {
    if (isOpen) {
      loadEventList()
    }
  }, [isOpen])

  const loadEventList = async () => {
    setEventLoading(true)
    try {
      // 기존에 구축되어 있는 event/list API 또는 전용 관리 라우트 호출app\api\events\list
      const res = await fetch('/api/events/list') 
      const data = await res.json()
      
      if (res.ok && data.items) {
        setEvents(data.items)
        if (data.items.length > 0) {
          setSelectedEventId(data.items[0].id) // 첫 번째 행사를 기본값으로 바인딩
        }
      } else {
        // 백엔드 명세에 따라 items가 아닌 직접 배열 반환 예외 처리
        const items = Array.isArray(data) ? data : (data.data || [])
        setEvents(items)
        if (items.length > 0) setSelectedEventId(items[0].id)
      }
    } catch (err) {
      console.error('행사 리스트를 불러오는 데 실패했습니다.', err)
    } finally {
      setEventLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!userKeyword.trim() || !selectedEventId || !reason.trim() || !checkTime) {
      alert('유저 성명/학번, 대상 행사 선택, 인식 처리 시각, 추가 사유는 필수 입력 항목입니다.')
      return
    }

    setLoading(true)
    try {
      const attendanceDate = checkTime.split('T')[0]

      const res = await fetch('/api/attendance/manage/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_keyword: userKeyword.trim(),
          event_id: selectedEventId, // 💡 이제 정확한 event_id(UUID)를 다이렉트로 전송합니다.
          attendance_date: attendanceDate,
          status,
          method,
          check_time: new Date(checkTime).toISOString(),
          reason: reason.trim()
        })
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || '출석 기록 추가 중 오류가 발생했습니다.')
      }

      alert(`[성공] ${attendanceDate} 자로 과거 출석 기록이 추가되었습니다.`)
      
      // 💡 화면 전체 리로드 방지: 폼을 닫지 않고 입력 필드 중 유저 검색어만 부분 초기화하여 연속 기입 편의성 제공
      setUserKeyword('')
      
      // 💡 부모 컴포넌트의 특정 State 재검증 콜백 함수 트리거 (전체새로고침X)
      onSuccess(attendanceDate)
    } catch (err: any) {
      alert(err.message || '서버 통신 예외 발생')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <div style={{ marginBottom: '24px', textAlign: 'right' }}>
        <button
          onClick={() => setIsOpen(true)}
          style={{ padding: '10px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
        >
          ➕ 수동 출석 추가 기록 (리스트 선택형)
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>새로운 출석 기록 추가 (관리자 권한)</h3>
        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>접기 🔼</button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>대상 유저 검색 (성명 또는 학번)</label>
          <input type="text" value={userKeyword} onChange={(e) => setUserKeyword(e.target.value)} placeholder="예: 홍길동 또는 20231234" style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} />
        </div>

        {/* 💡 직접 입력창에서 드롭다운 리스트 선택 창으로 변경 완료 */}
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>대상 행사 명칭 선택</label>
          <select 
            value={selectedEventId} 
            onChange={(e) => setSelectedEventId(e.target.value)} 
            disabled={eventLoading}
            style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff', height: '39px' }}
          >
            {eventLoading ? (
              <option>행사 정보를 가져오는 중...</option>
            ) : events.length === 0 ? (
              <option>등록된 행사가 없습니다</option>
            ) : (
              events.map((evt) => {
                const localDate = evt.start_time ? new Date(evt.start_time).toLocaleDateString() : '';
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
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>출석 상태</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}>
            <option value="present">출석 (Present)</option>
            <option value="late">지각 (Late)</option>
            <option value="absent">결석 (Absent)</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>인식 수단</label>
          <select value={method} onChange={(e) => setMethod(e.target.value as AttendanceMethod)} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff' }}>
            <option value="manual">관리자 수동 입력 (Manual)</option>
            <option value="qr">QR 코드 인식</option>
            <option value="nfc">NFC 태깅</option>
          </select>
        </div>

        <div style={{ gridColumn: 'span 1' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>인식 처리 시각</label>
          <input type="datetime-local" value={checkTime} onChange={(e) => setCheckTime(e.target.value)} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} />
        </div>

        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>생성 및 수동 추가 사유</label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 행정 처리 누락으로 인한 과거 출석 소급 적용" style={{ width: '100%', padding: '9px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} />
        </div>

        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button type="submit" disabled={loading || events.length === 0} style={{ padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
            {loading ? '기록 저장 중...' : '출석 기록 생성'}
          </button>
        </div>
      </form>
    </div>
  )
}
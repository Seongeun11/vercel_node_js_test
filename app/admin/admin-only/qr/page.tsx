//app\admin\admin-only\qr\page.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
// 💡 공용 컴포넌트 Import
import AffiliationSelect from '@/components/common/affiliation-select'
// ==========================================
// 1. 시스템 공통 타입 정의 (기존 규격 완벽 유지 + 확장)
// ==========================================
export type WeekdayCode = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
export type RecurrenceType = 'none' | 'daily'
export type OccurrenceStatus = 'scheduled' | 'open' | 'closed' | 'archived'


export interface AffiliationItem {
  id: number
  name: string
}

export interface QrTokenItem {
  id: string
  event_id: string
  occurrence_id: string | null
  expires_at: string
  used_count: number
  created_at: string
  qr_url: string | null //백엔드 덤프에서 제공하는 실제 스캔 가능 URL
  token_preview: string
  //is_pre_generated?: boolean // 사전 생성 여부 플래그
}

export interface EventItem {
  id: string
  name: string
  start_time: string
  late_threshold_min: number
  allow_duplicate_check: boolean
  is_special_event: boolean
  recurrence_type: RecurrenceType
  recurrence_days: WeekdayCode[]
  is_active: boolean
  created_at: string
  updated_at: string
  affiliations_id: string | number | null
  affiliation_name: string // 💡 백엔드 전용 JOIN 필드로 타입 보완 처리 추가 스펙화
}

export interface EventFormState {
  name: string
  start_time: string
  late_threshold_min: string | number
  allow_duplicate_check: boolean
  is_special_event: boolean
  recurrence_type: RecurrenceType
  recurrence_days: WeekdayCode[]
  is_active: boolean
  affiliations_id: string | number | null
  pre_generate_qr: boolean // QR 코드 사전 발행 여부 체크박스 연동
  qr_valid_duration_min: string | number // 사전 발행 QR의 유효 기간(분)
}

export const WEEKDAY_OPTIONS: { label: string; value: WeekdayCode }[] = [
  { label: '일', value: 'sun' },
  { label: '월', value: 'mon' },
  { label: '화', value: 'tue' },
  { label: '수', value: 'wed' },
  { label: '목', value: 'thu' },
  { label: '금', value: 'fri' },
  { label: '토', value: 'sat' },
]

const WEEKDAY_ORDER: Record<WeekdayCode, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
}

// ==========================================
// 2. 시간 및 포맷 유틸리티 함수
// ==========================================
export function toDateTimeLocalValue(isoString: string): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function normalizeRecurrenceDays(days: WeekdayCode[] | null | undefined): WeekdayCode[] {
  if (!Array.isArray(days)) return []
  const validDays = days.filter((d): d is WeekdayCode => typeof d === 'string' && d in WEEKDAY_ORDER)
  return Array.from(new Set(validDays)).sort((a, b) => WEEKDAY_ORDER[a] - WEEKDAY_ORDER[b])
}

export function formatRecurrenceDays(days: WeekdayCode[]): string {
  if (!days || days.length === 0) return '단발성 행사'
  if (days.length === 7) return '매일 반복'
  return days.map(d => WEEKDAY_OPTIONS.find(o => o.value === d)?.label ?? '').join(', ')
}

// ==========================================
// 3. 인라인 UI 스타일 정의
// ==========================================
const styles = {
  containerStyle: { padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif', color: '#1e293b' },
  panelStyle: { background: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -1px rgb(0 0 0 / 0.03)', marginBottom: '24px', border: '1px solid #e2e8f0' },
  formLayoutStyle: { display: 'flex', flexDirection: 'column' as const, gap: '16px' },
  fieldLabelStyle: { display: 'flex', flexDirection: 'column' as const, gap: '6px', fontSize: '14px', fontWeight: 600 },
  inputStyle: { padding: '10px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', width: '100%', boxSizing: 'border-box' as const },
  checkboxLabelStyle: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 500 },
  weekdayBadgeStyle: { display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '20px', border: '1px solid #cbd5e1', fontSize: '13px' },
  primaryButtonStyle: { padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' },
  successButtonStyle: { padding: '10px 20px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' },
  secondaryButtonStyle: { padding: '10px 20px', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' },
  dangerButtonStyle: { padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' },
  tableStyle: { width: '100%', borderCollapse: 'collapse' as const, marginTop: '12px', fontSize: '14px' },
  thStyle: { padding: '12px', textAlign: 'left' as const, borderBottom: '2px solid #e2e8f0', background: '#f8fafc', fontWeight: 600 },
  tdStyle: { padding: '12px', borderBottom: '1px solid #e2e8f0' },
  emptyBoxStyle: { padding: '40px', textAlign: 'center' as const, color: '#94a3b8', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' },
  badgeScheduled: { padding: '2px 8px', background: '#fef3c7', color: '#d97706', borderRadius: '4px', fontSize: '12px', fontWeight: 500 },
  badgeOpen: { padding: '2px 8px', background: '#dcfce7', color: '#16a34a', borderRadius: '4px', fontSize: '12px', fontWeight: 500 },
  qrPreviewBox: { padding: '12px', background: '#f1f5f9', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '8px', display: 'inline-block', textAlign: 'center' as const },
  // 💡 추가 레이아웃: 모달 백드롭 및 컨텐츠 스타일
  modalBackdrop: { position: 'fixed' as const, top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { background: '#fff', padding: '32px', borderRadius: '16px', textAlign: 'center' as const, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', maxWidth: '400px', width: '90%' }
}

const DEFAULT_FORM: EventFormState = {
  name: '',
  start_time: toDateTimeLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()), // 기본값을 내일 이 시간으로 지정 (미래 예약 직관성 전제)
  late_threshold_min: '10',
  allow_duplicate_check: false,
  is_special_event: false,
  recurrence_type: 'none',
  recurrence_days: [],
  is_active: true,
  affiliations_id: '',
  pre_generate_qr: true, // 미래 사용 목적 QR 선발행 활성화 기본값
  qr_valid_duration_min: '60' // 미래 행사 시작 후 60분간 유효
}

// ==========================================
// 4. 메인 통합 관제 클라이언트 컴포넌트
// ==========================================
export default function CentralizedEventsQrClient() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [affiliations, setAffiliations] = useState<AffiliationItem[]>([])
  const [activeQrTokens, setActiveQrTokens] = useState<Record<string, QrTokenItem>>({}) // event_id별 발급된 QR 매핑 저장소
  
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<EventFormState>(DEFAULT_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  // 💡 크게보기 기능 구현을 위한 전용 모달 State 정의
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedQr, setSelectedQr] = useState<{ eventName: string; qrUrl: string } | null>(null)

  // 💡 [추가] 선택된 소속 필터링 상태 (공백 문자열값은 '전체 보기'를 의미)
  const [selectedAffiliationId, setSelectedAffiliationId] = useState<string>('')
  
  // 데이터 동기화 함수
  const refreshAllData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      // ❌ 변경 논리: 소속 정보 로딩 API 불필요 구역으로 제거 완료 (공용 컴포넌트가 알아서 수행)

      // 2. 중앙 집중형 이벤트 전체 리스트업 조회
      const eventRes = await fetch('/api/events/list', { method: 'GET', cache: 'no-store' })
      const eventData = await eventRes.json()
      if (eventRes.ok && eventData.items) {
        setEvents(eventData.items)
      }

      // 3. 전역 QR 토큰 덤프 가져오기
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

  // ❌ 변경 논리: affiliationMap 생성용 useMemo 로직 완벽히 제거 처리
  // 소속 선택 필터링은 프론트엔드 연산 최적화를 위해 유지
  // 💡 [추가] 소속 선택 상태에 따른 이벤트 필터링 연산
  const filteredEvents = useMemo(() => {
    if (!selectedAffiliationId) return events // 전체 노출
    return events.filter(event => {
      // 데이터 타입 보정을 위해 비교 연산 시 string으로 통일화하여 판별
      return String(event.affiliations_id) === selectedAffiliationId
    })
  }, [events, selectedAffiliationId])
// ==========================================
  // 6. 독립형 QR 코드 사후/사전 독점 발행 핸들러 (수정본)
  // ==========================================
  const handleStandaloneQrPreGenerate = async (eventId: string, startTimeIso: string) => {
      try {
        setSubmitting(true)
        setError('')
        setSuccess('')
        
        // 💡 논리 구조 설계: 회차가 부재한 미래 예약건이므로 
        // occurrence_id는 제거/null 처리하고 부모 event_id 기반 'unlimited' 옵션 파라미터를 하이브리드로 주입합니다.
        const requestPayload = {
          event_id: eventId,
          occurrence_id: null,
          expire_unit: 'unlimited',
          expire_value: null
        }

        const res = await fetch('/api/qr/create', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify(requestPayload)
        })

        const data = await res.json()

        if (!res.ok || data.error) {
          throw new Error(data.error || 'QR 예약 발행 트랜잭션이 거부되었습니다.')
        }
        
        setSuccess(data.message || '예약 일정에 대응하는 배포/인쇄용 QR 생성에 성공했습니다.')
        
        // 상태 최신 덤프 리로드 동기화
        await refreshAllData()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'QR 발급 과정 중 알 수 없는 오류가 발생했습니다.')
      } finally {
        setSubmitting(false)
      }
    }
  // qr 다운로드 함수
  const handleDownloadQrImage = (eventName: string) => {
    // 1) 렌더링된 고화질 QR Canvas 엘리먼트 탐색
    const canvas = document.getElementById('zoom-qr-canvas') as HTMLCanvasElement | null
    if (!canvas) {
      alert('QR 코드 이미지를 준비하는 중 오류가 발생했습니다.')
      return
    }

    try {
      // 2) Canvas의 픽셀 데이터를 PNG 데이터 URL로 추출
      const qrDataUrl = canvas.toDataURL('image/png')

      // 3) 가상 가상 앵커 돔 요소를 생성하여 즉시 다운로드 실행 후 소멸
      const link = document.createElement('a')
      link.href = qrDataUrl
      // 파일명 공백 방지 및 파일 포맷 가독성 보정
      link.download = `${eventName.replace(/\s+/g, '_')}_출석QR.png`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('QR 이미지 저장 에러:', err)
      alert('브라우저 보안 제약 또는 장치 문제로 파일 저장에 실패했습니다.')
    }
  }
  // 기존 수명 연장 기능 완벽 유지 및 확장 (이벤트 관련 qr중앙제어.txt 스펙 연동)
  const handleExtendQrDuration = async (id: string) => {
    try {
      setSubmitting(true)
      const extendedTime = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 현재 시점 기준 30분 추가 연장
      
      const res = await fetch('/api/qr/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, expires_at: extendedTime })
      })
      if (!res.ok) throw new Error('QR 만료 연장 실패')
      setSuccess('선택한 QR 토큰의 만료 수명이 실시간으로 30분 추가 연장되었습니다.')
      await refreshAllData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR 제어기 통신 에러')
    } finally {
      setSubmitting(false)
    }
  }

// 💡 [완전 재작성] QR 삭제 핸들러 기능 보정 및 논리 완성본
  const handleDeleteQR = useCallback(async (qrId: string,eventId: string) => {
    const isConfirmed = window.confirm(
      '이 QR 코드를 정말로 삭제하시겠습니까?\n삭제 후에는 수련생들이 이 QR로 출석할 수 없습니다.'
    )
    if (!isConfirmed) return

    try {
      setError('')
      setSuccess('')

      // 백엔드 엔드포인트 규격과 일치시킴
      const res = await fetch('/api/qr/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: qrId }),
      });

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'QR 코드를 삭제하는 도중 오류가 발생했습니다.')
      }

      alert(result.message || 'QR 코드가 성공적으로 삭제되었습니다.')

      // 🎯 핵심 교정: 객체 맵 구조(Record)의 불변성을 지키며 화면에서 실시간 즉시 삭제
      setActiveQrTokens((prevMap) => {
        const nextMap = { ...prevMap }
        delete nextMap[eventId] // 해당 이벤트 아이디 키를 맵에서 제거
        return nextMap
      })

    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[HANDLE_DELETE_QR_ERROR]', error)
      }
      alert(`삭제 실패: ${error.message}`)
    }
  }, [])

 

  // 💡 크게보기 모달 핸들러 오픈 함수
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

        {/* 💡 [추가] 소속 필터링 컨트롤 UI 셀렉트 박스 */}
        <div style={{ ...styles.panelStyle, display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 24px' }}>
          <label htmlFor="affiliation-filter" style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
            🔍 소속 필터 조회 :
          </label>
          {/* 💡 정제 추출된 공용 컴포넌트 주입 */}
        <AffiliationSelect 
          value={selectedAffiliationId} 
          onChange={setSelectedAffiliationId} 
        />
          {selectedAffiliationId && (
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              총 <strong>{filteredEvents.length}</strong>개의 예약 건이 검색되었습니다.
            </span>
          )}
        </div>

        {/* 중앙 제어 보드 현황 리스트 */}
        <h3 style={{ fontSize: '20px', color: '#1e293b', marginBottom: '12px' }}>QR 예약 및 발급 현황 내역</h3>
        {loading ? (
          <div style={styles.emptyBoxStyle}>서버 데이터베이스 동기화 중...</div>
        ) : filteredEvents.length === 0 ? ( // 💡 [수정] events -> filteredEvents 변경
          <div style={styles.emptyBoxStyle}>조건에 부합하는 예약 QR 코드가 존재하지 않습니다.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.tableStyle}>
              <thead>
                <tr>
                  <th style={styles.thStyle}>행사 이름</th>
                  <th style={styles.thStyle}>소속</th>
                  <th style={styles.thStyle}>행사 시작 시각</th>
                  <th style={styles.thStyle}>상태</th>
                  <th style={styles.thStyle}>주기</th>
                  <th style={styles.thStyle}>예약 QR 정보</th>
                  <th style={styles.thStyle}>수정 및 관리</th>
                </tr>
              </thead>
              <tbody>
                {/* 💡 [수정] events.map -> filteredEvents.map 변경 */}
                {filteredEvents.map((event) => {
                  
                  const isFuture = new Date(event.start_time) > new Date()
                  const attachedToken = activeQrTokens[event.id]

                  return (
                    <tr key={event.id} style={{ background: editingId === event.id ? '#f0f9ff' : 'transparent' }}>
                      <td style={{ ...styles.tdStyle, fontWeight: 700 }}>{event.name}</td>
                      {/* 💡 기존의 매핑 맵 대신, 백엔드로부터 가공 전송된 필드데이터 직접 바인딩 완료 */}
                      <td style={{ ...styles.tdStyle, color: '#2563eb', fontWeight: 500 }}>
                        {event.affiliation_name}
                      </td>
                      <td style={styles.tdStyle}>{new Date(event.start_time).toLocaleString()}</td>
                      <td style={styles.tdStyle}>

                    
                  
                        {isFuture ? (
                          <span style={styles.badgeScheduled}>예약 대기 (Scheduled)</span>
                        ) : (
                          <span style={styles.badgeOpen}>활성화 진행 (Open)</span>
                        )}
                      </td>
                      <td style={styles.tdStyle}>{formatRecurrenceDays(event.recurrence_days)}</td>
                      <td style={styles.tdStyle}>
                        {attachedToken ? (
                          <div style={styles.qrPreviewBox}>
                            <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold', marginBottom: '2px' }}>QR 연동됨 ({attachedToken.token_preview})</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <button
                                onClick={() => openQrZoomModal(event.name, attachedToken.qr_url)}
                                style={{ padding: '4px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '4px' }}
                              >
                                🔍 QR 코드 크게보기
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>발행 내역 없음</div>
                            <button onClick={() => void handleStandaloneQrPreGenerate(event.id, event.start_time)} style={{ padding: '4px 8px', fontSize: '11px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                              qr 예약 하기
                            </button>
                          </div>
                        )}
                      </td>
                      
                      <td style={styles.tdStyle}>
                      {/* 💡 [수정 연동] 정상 선언된 attachedToken 검증 후 고유 ID 및 이벤트 ID 전달 */}
                      {attachedToken ? (
                        <button 
                          onClick={() => handleDeleteQR(attachedToken.id, event.id)} 
                          style={styles.dangerButtonStyle}
                        >
                          QR 삭제
                        </button>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>삭제 대상 없음</span>
                      )}
                    </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

              {/* ========================================== */}
      {/* 💡 크게보기 기능 제어용 라이트박스 모달 UI 레이어 */}
      {/* ========================================== */}
      {isModalOpen && selectedQr && (
        <div style={styles.modalBackdrop} onClick={() => setIsModalOpen(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{selectedQr.eventName}</h4>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>현장 스캐너 인식용 QR 코드입니다.</p>
            
            {/* 💡 파일 추출이 용이하도록 QRCodeCanvas 규격 사용 및 고유 id 바인딩 */}
      <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', display: 'inline-block', boxShadow: '0 0 0 1px #e2e8f0' }}>
        <QRCodeCanvas 
          id="zoom-qr-canvas"
          value={selectedQr.qrUrl} 
          size={256} // 고화질 출력을 보장하는 확장 해상도 비율
          level="H"   // 카메라 렌즈 이물질이나 인쇄 번짐에도 인식 가능하도록 High 레벨 정정 적용
          includeMargin={true}
        />
      </div>
      
      {/* 버튼 배치 영역에 'QR 코드 이미지 저장' 트리거 추가 */}
      <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* 다운로드 버튼 */}
        <button 
          onClick={() => handleDownloadQrImage(selectedQr.eventName)}
          style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}
        >
          QR 이미지(.PNG) 저장하기
        </button>

        {/* 닫기 버튼 */}
        <button 
          onClick={() => setIsModalOpen(false)}
          style={{ width: '100%', padding: '10px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '14px' }}
        >
          화면 닫기
        </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

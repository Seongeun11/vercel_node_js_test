'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// ==========================================
// 1. 타입 및 인터페이스 정의 (기존 API 형식 준수)
// ==========================================
type QrItem = {
  id: string
  occurrence_id: string
  event_id: string
  event_name: string
  qr_url: string
  start_time: string 
  expire_at: string | null
  is_active: boolean
}

// 내부 실제 대시보드 코어 컴포넌트
function QrManagementInner() {
  const searchParams = useSearchParams()
  // URL 주소창에서 (?event_id=값)을 파싱하여 동적으로 가져옵니다.
  const eventId = searchParams.get('event_id') || ''

  // 상태 관리
  const [qrList, setQrList] = useState<QrItem[]>([])
  const [eventName, setEventName] = useState<string>('이벤트')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // QR 생성 폼 상태
  const [isImmediate, setIsImmediate] = useState<boolean>(true)
  const [customStartTime, setCustomStartTime] = useState<string>(toDateTimeLocalValue(new Date().toISOString()))
  const [expireUnit, setExpireUnit] = useState<string>('unlimited') 
  const [expireValue, setExpireValue] = useState<number>(1)

  // 모달 및 UX 상태
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [activeQrUrl, setActiveQrUrl] = useState('')
  const [activeQrImage, setActiveQrImage] = useState('')

  // 💡 [수정] 초기 데이터 로드 및 결크 값 예외 처리
  useEffect(() => {
    if (eventId) {
      void fetchQrData()
    } else {
      // 주소창에 event_id가 아예 없을 경우 로딩을 해제하고 에러 메시지를 표시합니다.
      setError('올바른 접근이 아닙니다. URL에 event_id 파라미터가 누락되었습니다.')
      setLoading(false)
    }
  }, [eventId])

  // 주기적으로 '즉시' 시간 상태값 갱신 업데이트
  useEffect(() => {
    if (isImmediate) {
      setCustomStartTime(toDateTimeLocalValue(new Date().toISOString()))
    }
  }, [isImmediate])

  // ==========================================
  // 3. API 통신 함수 영역
  // ==========================================
  async function fetchQrData() {
    try {
      setLoading(true)
      setError('')
      const res = await fetch(`/api/qr/list?event_id=${eventId}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'QR 목록을 불러오지 못했습니다.')
      
      setQrList(Array.isArray(data.items) ? data.items : [])
      if (data.event_name) {
        setEventName(data.event_name)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로딩 중 오류 발생')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateQr() {
    if (!eventId) {
      setError('이벤트 ID가 유효하지 않아 QR을 생성할 수 없습니다.')
      return
    }
    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      const finalStartTime = isImmediate 
        ? new Date().toISOString() 
        : new Date(customStartTime).toISOString()

      const payload = {
        event_id: eventId,
        start_time: finalStartTime,
        expire_unit: expireUnit,
        expire_value: Number(expireValue),
        occurrence_id: eventId, 
      }

      const res = await fetch('/api/qr/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'QR 코드 생성 실패')

      setSuccess('새로운 출석 QR 코드가 성공적으로 발급되었습니다.')
      
      if (data.qr_url) {
        openQrModal(data.qr_url)
      }

      await fetchQrData() 
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR 생성 중 오류 발생')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleExtendQr(qrId: string) {
    if (!window.confirm('이 QR 코드의 유효 기간을 연장하시겠습니까?')) return
    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      const res = await fetch('/api/qr/extend', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: qrId, extend_min: 30 }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'QR 연장 실패')

      setSuccess('QR 코드 만료 시간이 30분 연장되었습니다.')
      await fetchQrData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR 연장 중 오류 발생')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteQr(qrId: string) {
    if (!window.confirm('정말 이 QR 코드를 삭제(폐기)하시겠습니까? 만료 전이라도 즉시 출석이 차단됩니다.')) return
    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      const res = await fetch('/api/qr/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: qrId }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'QR 삭제 실패')

      setSuccess('QR 코드가 성공적으로 폐기되었습니다.')
      await fetchQrData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QR 삭제 중 오류 발생')
    } finally {
      setSubmitting(false)
    }
  }

  function openQrModal(url: string) {
    setActiveQrUrl(url)
    setActiveQrImage(`https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(url)}`)
    setIsQrModalOpen(true)
  }

  async function handleCopyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      alert('출석 체크용 QR 링크가 클립보드에 복사되었습니다.')
    } catch (err) {
      console.error('링크 복사 실패:', err)
      alert('복사에 실패했습니다. 주소를 수동으로 복사해주세요.')
    }
  }

  if (loading) return <div style={{ padding: 20, fontSize: 15, fontWeight: '500' }}>QR 스케줄 데이터를 로딩하고 있습니다...</div>

  return (
    <div style={containerStyle}>
      <div>
        <h2 style={{ marginBottom: 4 }}>{eventName} - QR 대시보드 관리</h2>
        <p style={{ color: '#666', margin: 0 }}>해당 이벤트 고유 ID에 연동된 회차별 모든 QR 코드를 일괄 통제합니다.</p>
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      {/* 이벤트 ID 쿼리가 존재할 때만 핵심 대시보드 노출 */}
      {eventId && (
        <>
          {/* 폼 섹션 */}
          <section style={panelStyle}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>신규 QR 코드 발급 제어</h3>
            
            <div style={formLayoutStyle}>
              <div style={fieldLabelStyle}>
                <span style={{ fontWeight: '600', fontSize: '14px' }}>출석 시작 시간 설정</span>
                <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                  <label style={checkboxLabelStyle}>
                    <input type="radio" checked={isImmediate === true} onChange={() => setIsImmediate(true)} disabled={submitting} />
                    <span>즉시 발급 (현재 시각 기준)</span>
                  </label>
                  <label style={checkboxLabelStyle}>
                    <input type="radio" checked={isImmediate === false} onChange={() => setIsImmediate(false)} disabled={submitting} />
                    <span>시작 시간 직접 예약 지정</span>
                  </label>
                </div>
              </div>

              {!isImmediate && (
                <label style={fieldLabelStyle}>
                  <span>지정할 시작 일시</span>
                  <input type="datetime-local" value={customStartTime} onChange={(e) => setCustomStartTime(e.target.value)} style={inputStyle} disabled={submitting} />
                </label>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={fieldLabelStyle}>
                  <span>유효기간 제한 방식</span>
                  <select value={expireUnit} onChange={(e) => setExpireUnit(e.target.value)} style={inputStyle} disabled={submitting}>
                    <option value="unlimited">제한 없음 (영구)</option>
                    <option value="min">분 단위 지정</option>
                    <option value="hour">시간 단위 지정</option>
                  </select>
                </label>

                {expireUnit !== 'unlimited' && (
                  <label style={fieldLabelStyle}>
                    <span>만료 시간 값</span>
                    <input type="number" min={1} value={expireValue} onChange={(e) => setExpireValue(Number(e.target.value))} style={inputStyle} disabled={submitting} />
                  </label>
                )}
              </div>

              <div style={{ marginTop: 8 }}>
                <button onClick={() => void handleCreateQr()} disabled={submitting} style={primaryButtonStyle}>
                  {submitting ? '생성 요청 중...' : '조건으로 QR 코드 신규 생성'}
                </button>
              </div>
            </div>
          </section>

          {success && <div style={successBoxStyle}>{success}</div>}

          {/* 조회 리스트 테이블 섹션 */}
          <section style={{ display: 'grid', gap: 16 }}>
            <h3 style={{ margin: 0 }}>연동된 QR 발급 이력 목록</h3>
            {qrList.length === 0 ? (
              <div style={emptyBoxStyle}>이 이벤트로 등록/발급된 활성 QR 코드가 존재하지 않습니다.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={thStyle}>출석 지정 시작 시간</th>
                      <th style={thStyle}>만료 일시</th>
                      <th style={thStyle}>상태</th>
                      <th style={thStyle}>QR 링크 확인</th>
                      <th style={thStyle}>관리 액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qrList.map((qr) => (
                      <tr key={qr.id}>
                        <td style={tdStyle}>{new Date(qr.start_time).toLocaleString()}</td>
                        <td style={tdStyle}>{qr.expire_at ? new Date(qr.expire_at).toLocaleString() : '무제한'}</td>
                        <td style={tdStyle}>
                          <span style={{ color: qr.is_active ? '#166534' : '#b91c1c', fontWeight: 'bold' }}>
                            {qr.is_active ? '사용 가능' : '만료/폐기됨'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openQrModal(qr.qr_url)} style={inlineSecondaryButton}>크게 보기</button>
                            <button onClick={() => void handleCopyLink(qr.qr_url)} style={inlineSecondaryButton}>링크 복사</button>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {qr.is_active && qr.expire_at && (
                              <button onClick={() => void handleExtendQr(qr.id)} disabled={submitting} style={inlineSecondaryButton}>시간 연장 (+30분)</button>
                            )}
                            <button onClick={() => void handleDeleteQr(qr.id)} disabled={submitting} style={dangerButtonStyle}>폐기/삭제</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* 모달 레이어 */}
      {isQrModalOpen && activeQrImage && (
        <div onClick={() => setIsQrModalOpen(false)} style={modalBackdropStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalContentStyle}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700' }}>출석 인증 전용 QR</h4>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <img src={activeQrImage} alt="QR Code Large" style={{ width: '360px', height: '360px', maxWidth: '80vw', maxHeight: '80vw' }} />
            </div>
            <p style={{ wordBreak: 'break-all', marginTop: '12px', fontSize: '13px', color: '#475569', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #ebd5e1' }}>
              {activeQrUrl}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: '16px' }}>
              <button type="button" onClick={() => void handleCopyLink(activeQrUrl)} style={{ ...secondaryButtonStyle, flex: 1, height: '44px' }}>
                링크 복사하기
              </button>
              <button type="button" onClick={() => setIsQrModalOpen(false)} style={{ ...primaryButtonStyle, flex: 1, height: '44px' }}>
                창 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 헬퍼 함수
function toDateTimeLocalValue(isoString: string): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// 💡 [수정] 최종 Export 기본 컴포넌트 (Suspense 안전 래핑)
export default function QrManagementClient() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>클라이언트 엔진을 초기화 중입니다...</div>}>
      <QrManagementInner />
    </Suspense>
  )
}

// 기존 스타일 개체 동일 유지
const containerStyle: React.CSSProperties = { padding: 24, display: 'grid', gap: 24, background: '#fafafa', minHeight: '100vh' }
const panelStyle: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
const formLayoutStyle: React.CSSProperties = { display: 'grid', gap: 16, maxWidth: 600 }
const fieldLabelStyle: React.CSSProperties = { display: 'grid', gap: 6, fontSize: '14px', color: '#334155' }
const inputStyle: React.CSSProperties = { height: 42, padding: '0 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff' }
const checkboxLabelStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }
const primaryButtonStyle: React.CSSProperties = { height: 42, padding: '0 16px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14 }
const secondaryButtonStyle: React.CSSProperties = { height: 42, padding: '0 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer', fontWeight: 600, fontSize: 14 }
const inlineSecondaryButton: React.CSSProperties = { height: 32, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer', fontSize: 13 }
const dangerButtonStyle: React.CSSProperties = { height: 32, padding: '0 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '14px', borderBottom: '2px solid #e2e8f0', fontSize: 14, color: '#475569', fontWeight: '600' }
const tdStyle: React.CSSProperties = { padding: '14px', borderBottom: '1px solid #f1f5f9', fontSize: 14, color: '#334155', verticalAlign: 'middle' }
const emptyBoxStyle: React.CSSProperties = { padding: '24px', borderRadius: 10, background: '#fff', border: '1px dashed #cbd5e1', color: '#64748b', textAlign: 'center' }
const errorBoxStyle: React.CSSProperties = { padding: 14, borderRadius: 8, background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', fontSize: 14 }
const successBoxStyle: React.CSSProperties = { padding: 14, borderRadius: 8, background: '#f0fdf4', border: '1px solid #dcfce7', color: '#166534', fontSize: 14 }
const modalBackdropStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }
const modalContentStyle: React.CSSProperties = { background: '#fff', padding: '28px', borderRadius: 16, textAlign: 'center', maxWidth: '480px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }
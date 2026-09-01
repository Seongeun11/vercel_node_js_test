// app\attendance\my-absence-reason\components\absence-reason-manager.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export type AbsenceType = {
  id: number
  text: string
}

export type AbsenceItem = {
  id: string
  absence_type: number
  absence_type_name?: string // 추가된 타입
  start_date: string
  end_date: string
  absence_reason: string
  created_at: string
}

type Props = {
  absenceTypes: AbsenceType[]
}

export default function AbsenceReasonManager({ absenceTypes }: Props) {
  const router = useRouter()
  
  // 데이터 상태
  const [items, setItems] = useState<AbsenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 폼 입력 상태 (신청/수정 공용)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [absenceType, setAbsenceType] = useState<number>(absenceTypes[0]?.id || 1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const today = new Date().toISOString().split('T')[0]

  // 초기 날짜 설정
  useEffect(() => {
    setStartDate(today)
    setEndDate(today)
  }, [today])

  // 결석 사유 목록 조회 API
  const fetchList = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/attendance/absence-reason', { method: 'GET' })
      if (!res.ok) throw new Error('목록을 불러오지 못했습니다.')
      const data = await res.json()
      setItems(data.items || data || [])
    } catch (err: any) {
      setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // 폼 초기화
  const resetForm = () => {
    setEditingId(null)
    setAbsenceType(absenceTypes[0]?.id || 1)
    setStartDate(today)
    setEndDate(today)
    setReason('')
    setError('')
  }

  // 수정 모드 진입
  const handleEditClick = (item: AbsenceItem) => {
    setEditingId(item.id)
    setAbsenceType(item.absence_type)
    setStartDate(item.start_date)
    setEndDate(item.end_date)
    setReason(item.absence_reason)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 등록 및 수정 제출 (POST / PUT)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('결석 사유를 입력해주세요.')
      return
    }
    if (startDate > endDate) {
      setError('종료일은 시작일보다 빠를 수 없습니다.')
      return
    }

    setSubmitting(true)
    setError('')

    const method = editingId ? 'PUT' : 'POST'
    const bodyPayload = {
      ...(editingId && { id: editingId }),
      absence_type: Number(absenceType),
      start_date: startDate,
      end_date: endDate,
      absence_reason: reason.trim(),
    }

    try {
      const res = await fetch('/api/attendance/absence-reason', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      })

      const data = await res.json()
      if (res.ok) {
        alert(editingId ? '결석 사유가 수정되었습니다.' : '결석 사유가 등록되었습니다.')
        resetForm()
        fetchList()
      } else {
        setError(data.error || '처리에 실패했습니다.')
      }
    } catch {
      setError('서버 통신 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  // 삭제 처리 (DELETE)
  const handleDelete = async (id: string) => {
    if (!confirm('정말로 이 결석 사유를 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/attendance/absence-reason?id=${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        alert('삭제되었습니다.')
        if (editingId === id) resetForm()
        fetchList()
      } else {
        const data = await res.json()
        alert(data.error || '삭제 처리에 실패했습니다.')
      }
    } catch {
      alert('서버 통신 중 오류가 발생했습니다.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. 입력 / 수정 폼 카드 */}
      <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '12px', padding: '20px' }}>
        
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>
          {editingId ? '✏️ 결석 사유 수정하기' : '📝 결석 사유 등록하기'}
          
        </h3>
        

        {error && (
          <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>구분</label>
            <select
              value={absenceType}
              onChange={(e) => setAbsenceType(Number(e.target.value))}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
            >
              {absenceTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.text}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>상세 사유</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="상세 사유를 적어주세요."
              rows={3}
              maxLength={500}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                style={{ flex: 1, padding: '10px', background: '#f3f4f6', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}
              >
                취소
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              style={{
                flex: 2,
                padding: '10px',
                background: editingId ? '#16a34a' : '#0070f3',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? '처리 중...' : editingId ? '수정 완료' : '등록 완료'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. 결석 사유 내역 조회 및 수정/삭제 목록 카드 */}
      <div>
        <h3 style={{ marginBottom: '12px' }}>📋 내 결석 사유 신청 내역</h3>
        
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>내역을 불러오는 중입니다...</div>
        ) : items.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '12px', padding: '20px', textAlign: 'center', color: '#888' }}>
            등록된 결석 사유가 없습니다.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {items.map((item) => {
              // 서버에서 넘겨준 absence_type_name을 바로 사용 (fallback으로 props 기반 탐색)
                const typeLabel =
                item.absence_type_name ||
                absenceTypes.find((t) => Number(t.id) === Number(item.absence_type))?.text ||
                '미지정'
              return (
                <div
                  key={item.id}
                  style={{
                    background: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', color: '#2563eb', fontSize: '14px' }}>
            [{typeLabel}]
          </span>
          <span style={{ fontSize: '12px', color: '#888' }}>
            {item.start_date} ~ {item.end_date}
          </span>
        </div>

        <p style={{ margin: '4px 0', fontSize: '14px', whiteSpace: 'pre-wrap', color: '#333' }}>
          {item.absence_reason}
        </p>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleEditClick(item)}
                      style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '4px', border: 'none', background: '#fee2e2', color: '#b91c1c', cursor: 'pointer' }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
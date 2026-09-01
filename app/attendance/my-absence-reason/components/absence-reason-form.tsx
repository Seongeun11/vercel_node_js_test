//app\attendance\my-absence-reason\components\absence-reason-form.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { AbsenceType, AbsenceItem } from './absence-reason-list'

type Props = {
  absenceTypes: AbsenceType[]
  editingItem: AbsenceItem | null
  onSuccess: () => void
  onCancelEdit: () => void
}

export default function AbsenceReasonForm({ absenceTypes, editingItem, onSuccess, onCancelEdit }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [absenceType, setAbsenceType] = useState<number>(absenceTypes[0]?.id || 1)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (editingItem) {
      setAbsenceType(editingItem.absence_type)
      setStartDate(editingItem.start_date)
      setEndDate(editingItem.end_date)
      setReason(editingItem.absence_reason)
    } else {
      setAbsenceType(absenceTypes[0]?.id || 1)
      setStartDate(today)
      setEndDate(today)
      setReason('')
    }
  }, [editingItem, absenceTypes, today])

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

    const method = editingItem ? 'PUT' : 'POST'
    const bodyPayload = {
      ...(editingItem && { id: editingItem.id }),
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

      if (res.ok) {
        alert(editingItem ? '수정되었습니다.' : '등록되었습니다.')
        onSuccess()
      } else {
        const data = await res.json()
        setError(data.error || '처리에 실패했습니다.')
      }
    } catch {
      setError('서버 통신 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '12px', padding: '20px' }}>
      <h3 style={{ marginTop: 0, marginBottom: '16px' }}>{editingItem ? '✏️ 결석 사유 수정하기' : '📝 결석 사유 등록하기'}</h3>
      {error && <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>구분</label>
          <select value={absenceType} onChange={(e) => setAbsenceType(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
            {absenceTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.text}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>시작일</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>종료일</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '13px' }}>상세 사유</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          {editingItem && (
            <button type="button" onClick={onCancelEdit} style={{ flex: 1, padding: '8px', background: '#f3f4f6', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}>취소</button>
          )}
          <button type="submit" disabled={submitting} style={{ flex: 2, padding: '8px', background: editingItem ? '#16a34a' : '#0070f3', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            {submitting ? '처리 중...' : editingItem ? '수정 완료' : '등록 완료'}
          </button>
        </div>
      </form>
    </div>
  )
}
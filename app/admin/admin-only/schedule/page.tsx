'use client'

import React, { useState, useEffect, useCallback } from 'react'
import ScheduleTableList from './components/schedule-table-list'
import ScheduleFormModal from './components/schedule-form-modal'

export type ScheduleItem = {
  id: number
  user_id: string
  absence_type: number
  absence_reason: string | null
  start_date: string | null
  end_date: string | null
  is_ended: boolean
  created_at: string
  profiles: {
    full_name: string
    student_id: string
    cohort_no: number | null
    affiliation: { name: string } | null
  } | null
  absence_type_info: {
    id: number
    text: string
  } | null
}

export type AbsenceType = {
  id: number
  text: string
}

type DateChangeHandler = (startDate: string, endDate: string) => void
type ScheduleActionHandler = (item: ScheduleItem) => void
type ScheduleDeleteHandler = (id: number) => Promise<void>

interface ScheduleModalSuccessCallback {
  (data: unknown, isEdit: boolean): void
}

const formatDateStr = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function AdminSchedulePage() {
  const today = new Date()
  const weekAgo = new Date()
  weekAgo.setDate(today.getDate() - 7)

  const [startDate, setStartDate] = useState(formatDateStr(weekAgo))
  const [endDate, setEndDate] = useState(formatDateStr(today))

  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [absenceTypes, setAbsenceTypes] = useState<AbsenceType[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null)

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    setMessage('')
    setErrorMessage('')
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)

      const res = await fetch(`/api/admin/users/schedules?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) {
        setSchedules(data.schedules || [])
        setAbsenceTypes(data.absenceTypes || [])
      } else {
        setErrorMessage(data.error || '스케쥴 목록을 불러오지 못했습니다.')
      }
    } catch {
      setErrorMessage('서버 통신 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    void fetchSchedules()
  }, [fetchSchedules])

  const handleDelete = async (id: number) => {
    if (!confirm('정말로 이 스케쥴을 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/admin/users/schedules?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setMessage('스케쥴이 삭제되었습니다.')
        fetchSchedules()
      } else {
        const data = await res.json()
        setErrorMessage(data.error || '삭제 실패')
      }
    } catch {
      setErrorMessage('서버 통신 실패')
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>스케쥴 관리</h1>
          <p style={{ color: '#475569', fontSize: '14px', marginTop: '4px' }}>
            수련생 및 아카데미생들의 외출, 휴가 및 출석 스케쥴을 관리합니다.
          </p>
        </div>
        <button
          onClick={() => { setEditingSchedule(null); setIsModalOpen(true); }}
          style={{
            backgroundColor: '#2563eb',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + 스케쥴 추가
        </button>
      </div>

      {message && <div style={{ padding: '12px', background: '#e0f2fe', color: '#0369a1', borderRadius: '6px', marginBottom: '16px' }}>{message}</div>}
      {errorMessage && <div style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '16px' }}>{errorMessage}</div>}

      <ScheduleTableList
        schedules={schedules}
        absenceTypes={absenceTypes}
        loading={loading}
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => { setStartDate(s); setEndDate(e); }}
        onRefresh={fetchSchedules}
        onEdit={(item) => { setEditingSchedule(item); setIsModalOpen(true); }}
        onDelete={handleDelete}
      />

      {isModalOpen && (
        <ScheduleFormModal
          absenceTypes={absenceTypes}
          initialData={editingSchedule}
          onClose={() => setIsModalOpen(false)}
          onSuccess={(_, isEdit) => {
            setMessage(isEdit ? '스케쥴이 수정되었습니다.' : '새 스케쥴이 등록되었습니다.')
            setIsModalOpen(false)
            fetchSchedules()
          }}
        />
      )}
    </div>
  )
}
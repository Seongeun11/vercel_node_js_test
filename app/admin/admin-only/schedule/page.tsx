//app\admin\admin-only\schedule\page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import ScheduleTableList from './components/schedule-table-list'
import ScheduleCreateModal from './components/schedule-create-modal'

// app/admin/admin-only/schedule/page.tsx 내 타입 선언
export type ScheduleItem = {
  id: string
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

export default function AdminSchedulePage() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [absenceTypes, setAbsenceTypes] = useState<AbsenceType[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchSchedules = async () => {
    setLoading(true)
    setMessage('')
    setErrorMessage('')
    try {
      const res = await fetch('/api/admin/users/schedules', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) {
        setSchedules(data.schedules || [])
        setAbsenceTypes(data.absenceTypes || [])
      } else {
        setErrorMessage(data.error || '스케쥴 목록을 불러오지 못했습니다.')
      }
    } catch (err) {
      setErrorMessage('서버 통신 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchSchedules()
  }, [])

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>스케쥴 관리</h1>
          <p style={{ color: '#000000', fontSize: '14px', marginTop: '4px' }}>
            수련생 및 아카데미생들의 외출, 휴가 및 출석 스케쥴을 독립적으로 관리합니다.<br/>이 스케쥴에 등록된 회원은 엑셀내보내기에서 출석체크 통계에 반영되지 않습니다.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
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
        setSchedules={setSchedules}
        absenceTypes={absenceTypes}
        loading={loading}
        onRefresh={fetchSchedules}
      />

      {isModalOpen && (
        <ScheduleCreateModal
          absenceTypes={absenceTypes}
          onClose={() => setIsModalOpen(false)}
          onSuccess={(newSchedule) => {
            setSchedules((prev) => [newSchedule, ...prev])
            setMessage('새 스케쥴이 등록되었습니다.')
            setIsModalOpen(false)
          }}
        />
      )}
    </div>
  )
}